import { analyse } from './analyse.ts';
import { generateDom } from './generate-dom.ts';
import { generateSsr } from './generate-ssr.ts';
import { parse } from './parse.ts';
import type { CompileTarget } from './types.ts';

export type { CompileTarget };

/** .svelte source -> JavaScript source for the given target. */
export function compile(content: string, target: CompileTarget): string {
  const ast = parse(content);
  const analysis = analyse(ast);
  return target === 'ssr' ? generateSsr(ast, analysis) : generateDom(ast, analysis);
}
