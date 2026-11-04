import jsep from 'nc-jsep';
import template from 'nc-jsep-plugin-template';
import object from 'nc-jsep-plugin-object';
import ternary from 'nc-jsep-plugin-ternary';
import arrow from 'nc-jsep-plugin-arrow';
import { jsepCurlyHook, jsepEqualsHook, jsepIndexHook } from './hooks';
import { FormulaErrorType } from './enums';
import { FormulaError } from './error';
import type { ParsedFormulaNode } from './types';

// Formula jsep instance - with curly hook only
export const formulaJsep = jsep.instance();
formulaJsep.defaultConfig();
formulaJsep.plugins.register(jsepCurlyHook, jsepEqualsHook);

// Formula jsep instance with position tracking - with curly hook and index hook
export const formulaJsepWithIndex = jsep.instance();
formulaJsepWithIndex.defaultConfig();
formulaJsepWithIndex.plugins.register(
  jsepCurlyHook,
  jsepEqualsHook,
  jsepIndexHook
);

// nc-jsep ships no types; every node it returns carries a string `type`
const isParsedFormulaNode = (node: unknown): node is ParsedFormulaNode =>
  typeof node === 'object' &&
  node !== null &&
  'type' in node &&
  typeof node.type === 'string';

const typedParser =
  (parse: (formula: string) => unknown) =>
  (formula: string): ParsedFormulaNode => {
    const node = parse(formula);
    if (!isParsedFormulaNode(node)) {
      throw new FormulaError(FormulaErrorType.INVALID_SYNTAX, {});
    }
    return node;
  };

export const parseFormula = typedParser(formulaJsep);
export const parseFormulaWithIndex = typedParser(formulaJsepWithIndex);

// Workflow jsep instance - with template, object, ternary plugins
export const workflowJsep = jsep.instance();
workflowJsep.defaultConfig();
workflowJsep.plugins.register(template, object, ternary, arrow);
