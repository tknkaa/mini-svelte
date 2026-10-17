import type {
  AssignmentExpression,
  ExpressionStatement,
  Identifier,
  Node,
  UpdateExpression,
} from 'estree';
import { walk } from 'estree-walker';
import * as periscopic from 'periscopic';
import { extractNames } from './extract-names.ts';
import type { Analysis, AttributeNode, Ast, Fragment, ReactiveDeclaration } from './types.ts';

/**
 * Figure out which variables change, which are used by the template,
 * and pull `$:` statements out of the script.
 */
export function analyse(ast: Ast): Analysis {
  const { scope: rootScope, map, globals } = periscopic.analyze(ast.script);

  const willChange = new Set<string>();
  const willUseInTemplate = new Set<string>();

  const reactiveDeclarations = collectReactiveDeclarations(ast, willChange);

  // reassigned top-level variables
  let currentScope = rootScope;
  walk(ast.script as Node, {
    enter(node) {
      if (map.has(node)) currentScope = map.get(node)!;
      if (node.type === 'UpdateExpression' || node.type === 'AssignmentExpression') {
        for (const name of assignedNames(node)) {
          if (currentScope.find_owner(name) === rootScope || globals.has(name)) {
            willChange.add(name);
          }
        }
      }
    },
    leave(node) {
      if (map.has(node)) currentScope = currentScope.parent!;
    },
  });

  ast.html.forEach((fragment) => collectTemplateUsage(fragment, willUseInTemplate));

  return {
    variables: new Set(rootScope.declarations.keys()),
    willChange,
    willUseInTemplate,
    reactiveDeclarations,
    rootScope,
    map,
  };
}

export function assignedNames(node: UpdateExpression | AssignmentExpression): string[] {
  return periscopic.extract_names(node.type === 'UpdateExpression' ? node.argument : (node.left as any));
}

function collectReactiveDeclarations(ast: Ast, willChange: Set<string>): ReactiveDeclaration[] {
  const declarations: ReactiveDeclaration[] = [];
  const toRemove = new Set<Node>();

  ast.script.body.forEach((node, index) => {
    if (node.type === 'LabeledStatement' && node.label.name === '$') {
      toRemove.add(node);
      const body = node.body as ExpressionStatement;
      const { left, right } = body.expression as AssignmentExpression;
      const dependencies: string[] = [];

      walk(right, {
        enter(n) {
          if (n.type === 'Identifier') dependencies.push((n as Identifier).name);
        },
      });

      const assignee = (left as Identifier).name;
      willChange.add(assignee);
      declarations.push({ assignees: [assignee], dependencies, node: body, index });
    }
  });

  ast.script.body = ast.script.body.filter((node) => !toRemove.has(node));
  return declarations;
}

function collectTemplateUsage(fragment: Fragment | AttributeNode, used: Set<string>): void {
  switch (fragment.type) {
    case 'Element':
      fragment.children.forEach((child) => collectTemplateUsage(child, used));
      fragment.attributes.forEach((attr) => collectTemplateUsage(attr, used));
      break;
    case 'Attribute':
      used.add((fragment.value as Identifier).name);
      break;
    case 'Expression':
      extractNames(fragment.expression).forEach((name) => used.add(name));
      break;
  }
}
