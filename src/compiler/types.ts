import type { Expression, Program } from 'estree';
import type { Scope } from 'periscopic';

export type Fragment = ElementNode | TextNode | ExpressionNode;

export interface ElementNode {
  type: 'Element';
  name: string;
  attributes: AttributeNode[];
  children: Fragment[];
}

export interface TextNode {
  type: 'Text';
  value: string;
}

export interface ExpressionNode {
  type: 'Expression';
  expression: Expression;
}

export interface AttributeNode {
  type: 'Attribute';
  name: string;
  value: Expression;
}

export interface Ast {
  html: Fragment[];
  script: Program;
}

/** `$: x = ...` */
export interface ReactiveDeclaration {
  assignees: string[];
  dependencies: string[];
  node: Program['body'][number];
  /** position in the original script body */
  index: number;
}

export interface Analysis {
  /** top-level variables declared in <script> */
  variables: Set<string>;
  /** variables that get reassigned somewhere */
  willChange: Set<string>;
  /** variables referenced from the template */
  willUseInTemplate: Set<string>;
  reactiveDeclarations: ReactiveDeclaration[];
  rootScope: Scope;
  map: WeakMap<object, Scope>;
}

export type CompileTarget = 'dom' | 'ssr';
