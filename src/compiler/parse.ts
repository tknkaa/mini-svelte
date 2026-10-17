import * as acorn from 'acorn';
import type { Expression, Program } from 'estree';
import type { Ast, AttributeNode, Fragment } from './types.ts';

const ECMA_VERSION = 2022;

/**
 * Hand-written recursive descent parser for a tiny subset of .svelte:
 * <script>, <tag attr={...}>, {expression} and plain text.
 * JS parts are delegated to acorn.
 */
export function parse(content: string): Ast {
  let i = 0;
  let script: Program | undefined;

  const html = parseFragments(() => i < content.length);

  if (!script) throw new Error('Parse error: missing <script>');
  return { html, script };

  function parseFragments(condition: () => boolean): Fragment[] {
    const fragments: Fragment[] = [];
    while (condition()) {
      const fragment = parseFragment();
      if (fragment) fragments.push(fragment);
    }
    return fragments;
  }

  function parseFragment(): Fragment | undefined {
    return parseScript() ?? parseElement() ?? parseExpression() ?? parseText();
  }

  // <script> is stored on the ast, not returned as a fragment
  function parseScript(): undefined {
    if (match('<script>')) {
      eat('<script>');
      const startIndex = i;
      const endIndex = content.indexOf('</script>', i);
      const code = content.slice(startIndex, endIndex);
      script = acorn.parse(code, { ecmaVersion: ECMA_VERSION }) as unknown as Program;
      i = endIndex;
      eat('</script>');
    }
  }

  function parseElement(): Fragment | undefined {
    if (match('<')) {
      eat('<');
      const tagName = readWhileMatching(/[a-z]/);
      const attributes = parseAttributeList();
      eat('>');
      const endTag = `</${tagName}>`;

      const element: Fragment = {
        type: 'Element',
        name: tagName,
        attributes,
        children: parseFragments(() => !match(endTag)),
      };
      eat(endTag);
      return element;
    }
  }

  function parseAttributeList(): AttributeNode[] {
    const attributes: AttributeNode[] = [];
    skipWhitespace();
    while (!match('>')) {
      attributes.push(parseAttribute());
      skipWhitespace();
    }
    return attributes;
  }

  function parseAttribute(): AttributeNode {
    const name = readWhileMatching(/[^=]/);
    eat('={');
    const value = parseJavaScript();
    eat('}');
    return { type: 'Attribute', name, value };
  }

  function parseExpression(): Fragment | undefined {
    if (match('{')) {
      eat('{');
      const expression = parseJavaScript();
      eat('}');
      return { type: 'Expression', expression };
    }
  }

  function parseText(): Fragment | undefined {
    const text = readWhileMatching(/[^<{]/);
    if (text.trim() !== '') {
      return { type: 'Text', value: text };
    }
  }

  function parseJavaScript(): Expression {
    const js = acorn.parseExpressionAt(content, i, { ecmaVersion: ECMA_VERSION });
    i = js.end;
    return js as unknown as Expression;
  }

  // whether the characters at `i` start with `str`
  function match(str: string): boolean {
    return content.slice(i, i + str.length) === str;
  }

  function eat(str: string): void {
    if (match(str)) {
      i += str.length;
    } else {
      throw new Error(`Parse error: expecting "${str}"`);
    }
  }

  function readWhileMatching(regex: RegExp): string {
    const startIndex = i;
    while (i < content.length && regex.test(content[i])) {
      i++;
    }
    return content.slice(startIndex, i);
  }

  function skipWhitespace(): void {
    readWhileMatching(/\s/);
  }
}
