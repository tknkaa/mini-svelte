import type { ReactiveDeclaration } from './types.ts';

/**
 * Order `$:` statements so that a declaration comes after the ones
 * that assign the variables it depends on. Falls back to source order.
 */
export function sortReactiveDeclarations(declarations: ReactiveDeclaration[]): ReactiveDeclaration[] {
  return [...declarations].sort((rd1, rd2) => {
    // rd2 depends on what rd1 changes -> rd2 after rd1
    if (rd1.assignees.some((a) => rd2.dependencies.includes(a))) return -1;
    // rd1 depends on what rd2 changes -> rd1 after rd2
    if (rd2.assignees.some((a) => rd1.dependencies.includes(a))) return 1;
    return rd1.index - rd2.index;
  });
}
