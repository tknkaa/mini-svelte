import * as acorn from 'acorn';
import * as escodegen from 'escodegen';
import type { Expression, Node, VariableDeclaration } from 'estree';
import { walk } from 'estree-walker';
import { assignedNames } from './analyse.ts';
import { extractNames } from './extract-names.ts';
import { sortReactiveDeclarations } from './reactive.ts';
import type { Analysis, Ast, Fragment, AttributeNode } from './types.ts';

interface DomCode {
  variables: string[];
  create: string[];
  update: string[];
  destroy: string[];
  reactiveDeclarations: string[];
}

function parseExpr(code: string): Expression {
  return acorn.parseExpressionAt(code, 0, { ecmaVersion: 2022 }) as unknown as Expression;
}

/** Generate the client-side component (creates / hydrates / updates DOM). */
export function generateDom(ast: Ast, analysis: Analysis): string {
  const code: DomCode = {
    variables: [],
    create: [],
    update: [],
    destroy: [],
    reactiveDeclarations: [],
  };

  generateTemplate(ast, analysis, code);
  instrumentScript(ast, analysis);
  generateReactiveDeclarations(analysis, code);

  return `
    export default function({ restored_state } = {}) {
      ${code.variables.map((v) => `let ${v};`).join('\n')}

      let collectChanges = [];
      let updateCalled = false;
      function update(changed) {
        changed.forEach(c => collectChanges.push(c));

        if (updateCalled) return;
        updateCalled = true;

        // first call
        update_reactive_declarations();
        if (typeof lifecycle !== 'undefined') lifecycle.update(collectChanges);
        collectChanges = [];
        updateCalled = false;
      }

      ${escodegen.generate(ast.script)}

      update(${JSON.stringify(Array.from(analysis.willChange))});

      function update_reactive_declarations() {
        ${code.reactiveDeclarations.join('\n')}
      }

      var lifecycle = {
        create(target, should_hydrate = target.childNodes.length > 0) {
          ${code.create.join('\n')}
        },
        update(changed) {
          ${code.update.join('\n')}
        },
        destroy(target) {
          ${code.destroy.join('\n')}
        },
        capture_state() {
          return { ${Array.from(analysis.variables).join(',')} };
        }
      };
      return lifecycle;
    }
  `;
}

/** Walk the template and emit create / update / destroy statements. */
function generateTemplate(ast: Ast, analysis: Analysis, code: DomCode): void {
  let counter = 1;
  // When hydrating, nodes are looked up by position under the parent.
  let hydrationIndex = 0;
  let hydrationParent = 'target';

  // Text and expressions are followed by an empty comment node in the SSR output,
  // so each one occupies two slots in childNodes.
  function createTextNode(parent: string, initial: string): string {
    const name = `txt_${counter++}`;
    code.variables.push(name);
    code.create.push(
      `${name} = should_hydrate ? ${hydrationParent}.childNodes[${hydrationIndex++}] : document.createTextNode(${initial});`,
      `if (!should_hydrate) ${parent}.appendChild(${name});`,
    );
    hydrationIndex++;
    return name;
  }

  function traverseElement(node: Fragment & { type: 'Element' }, parent: string): void {
    const name = `${node.name}_${counter++}`;
    code.variables.push(name);
    code.create.push(
      `${name} = should_hydrate ? ${hydrationParent}.childNodes[${hydrationIndex++}] : document.createElement('${node.name}');`,
    );
    node.attributes.forEach((attribute) => traverseAttribute(attribute, name));

    const savedParent = hydrationParent;
    const savedIndex = hydrationIndex;
    hydrationParent = name;
    hydrationIndex = 0;
    node.children.forEach((child) => traverse(child, name));
    hydrationParent = savedParent;
    hydrationIndex = savedIndex;

    code.create.push(`if (!should_hydrate) ${parent}.appendChild(${name});`);
    code.destroy.push(`${parent}.removeChild(${name});`);
  }

  function traverseAttribute(node: AttributeNode, parent: string): void {
    if (!node.name.startsWith('on:')) return;
    const eventName = node.name.slice(3);
    const handler = (node.value as { name: string }).name;
    code.create.push(`${parent}.addEventListener('${eventName}', ${handler});`);
    code.destroy.push(`${parent}.removeEventListener('${eventName}', ${handler});`);
  }

  function traverseExpression(node: Fragment & { type: 'Expression' }, parent: string): void {
    const expressionStr = escodegen.generate(node.expression);
    const name = createTextNode(parent, expressionStr);

    const changes = new Set(extractNames(node.expression).filter((n) => analysis.willChange.has(n)));
    if (changes.size === 0) return;

    const condition =
      changes.size > 1
        ? `${JSON.stringify(Array.from(changes))}.some(name => changed.includes(name))`
        : `changed.includes('${Array.from(changes)[0]}')`;
    code.update.push(`if (${condition}) {
      ${name}.data = ${expressionStr};
    }`);
  }

  function traverse(node: Fragment, parent: string): void {
    switch (node.type) {
      case 'Element':
        traverseElement(node, parent);
        break;
      case 'Text':
        createTextNode(parent, `'${node.value}'`);
        break;
      case 'Expression':
        traverseExpression(node, parent);
        break;
    }
  }

  ast.html.forEach((fragment) => traverse(fragment, 'target'));
}

/**
 * Rewrite the user's script in place:
 *  - `counter++` -> `(counter++, update(['counter']))`
 *  - `let x = 1` -> `let x = restored_state?.x ?? 1` (state survives HMR)
 */
function instrumentScript(ast: Ast, analysis: Analysis): void {
  const { rootScope, map } = analysis;
  let currentScope = rootScope;

  walk(ast.script as Node, {
    enter(node, parent) {
      if (map.has(node)) currentScope = map.get(node)!;

      if (node.type === 'UpdateExpression' || node.type === 'AssignmentExpression') {
        const names = assignedNames(node).filter(
          (name) => currentScope.find_owner(name) === rootScope && analysis.willUseInTemplate.has(name),
        );
        if (names.length > 0) {
          this.replace({
            type: 'SequenceExpression',
            expressions: [node, parseExpr(`update(${JSON.stringify(names)})`)],
          });
          this.skip();
        }
      }

      if (node.type === 'VariableDeclarator' && (parent as VariableDeclaration).kind !== 'const') {
        const name = (node.id as { name: string }).name;
        if (currentScope.find_owner(name) === rootScope) {
          this.replace({
            type: 'VariableDeclarator',
            id: node.id,
            init: {
              type: 'LogicalExpression',
              operator: '??',
              left: parseExpr(`restored_state?.${name}`),
              right: node.init!,
            },
          });
          this.skip();
        }
      }
    },
    leave(node) {
      if (map.has(node)) currentScope = currentScope.parent!;
    },
  });
}

function generateReactiveDeclarations(analysis: Analysis, code: DomCode): void {
  for (const { node, assignees, dependencies } of sortReactiveDeclarations(analysis.reactiveDeclarations)) {
    code.reactiveDeclarations.push(`
      if (${JSON.stringify(dependencies)}.some(name => collectChanges.includes(name))) {
        ${escodegen.generate(node)}
        update(${JSON.stringify(assignees)});
      }
    `);
    code.variables.push(...assignees);
  }
}
