import type { Expression } from 'estree';

/** Collect identifiers referenced by a (very small subset of) expression. */
export function extractNames(node: Expression, result: string[] = []): string[] {
  switch (node.type) {
    case 'Identifier':
      result.push(node.name);
      break;
    case 'BinaryExpression':
      extractNames(node.left as Expression, result);
      extractNames(node.right, result);
      break;
  }
  return result;
}
