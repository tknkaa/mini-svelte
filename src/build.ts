import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile } from './compiler/index.ts';

const root = (file: string) => fileURLToPath(new URL(`../${file}`, import.meta.url));

export const APP_SVELTE = root('app.svelte');

/** Compile app.svelte into app.js (client) and ssr.js (server). */
export function buildAppAndSsr(): void {
  const content = fs.readFileSync(APP_SVELTE, 'utf-8');
  fs.writeFileSync(root('app.js'), compile(content, 'dom'), 'utf-8');
  fs.writeFileSync(root('ssr.js'), compile(content, 'ssr'), 'utf-8');
}

// `pnpm build`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildAppAndSsr();
}
