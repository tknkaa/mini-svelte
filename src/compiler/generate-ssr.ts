import * as escodegen from 'escodegen';
import type { Expression, TemplateLiteral } from 'estree';
import { sortReactiveDeclarations } from './reactive.ts';
import type { Analysis, Ast, Fragment } from './types.ts';

/** Generate the server-side component: a function returning an HTML string. */
export function generateSsr(ast: Ast, analysis: Analysis): string {
  const variables: string[] = [];
  const reactiveDeclarations: string[] = [];

  const expressions: Expression[] = [];
  const quasis: string[] = [];
  let current = '';

  function addString(str: string): void {
    current += str;
  }
  function addExpression(expression: Expression): void {
    quasis.push(current);
    current = '';
    expressions.push(expression);
  }

  // `<!---->` separates adjacent text nodes so the browser doesn't merge them,
  // which keeps childNodes indices stable for hydration.
  function traverse(node: Fragment): void {
    switch (node.type) {
      case 'Element':
        addString(`<${node.name}>`);
        node.children.forEach(traverse);
        addString(`</${node.name}>`);
        break;
      case 'Text':
        addString(node.value);
        addString('<!---->');
        break;
      case 'Expression':
        addExpression(node.expression);
        addString('<!---->');
        break;
    }
  }

  ast.html.forEach(traverse);
  quasis.push(current);

  for (const { node, assignees } of sortReactiveDeclarations(analysis.reactiveDeclarations)) {
    reactiveDeclarations.push(escodegen.generate(node));
    variables.push(...assignees);
  }

  const templateLiteral: TemplateLiteral = {
    type: 'TemplateLiteral',
    expressions,
    quasis: quasis.map((str) => ({
      type: 'TemplateElement',
      tail: false,
      value: { raw: str, cooked: str },
    })),
  };

  return `
    export default function() {
      ${variables.map((v) => `let ${v};`).join('\n')}
      ${escodegen.generate(ast.script)}
      ${reactiveDeclarations.join('\n')}

      return ${escodegen.generate(templateLiteral)};
    }
  `;
}
