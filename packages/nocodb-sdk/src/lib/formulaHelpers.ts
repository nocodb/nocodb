import jsep from 'jsep';

import { ColumnType } from './Api';
import { jsepCurlyHook } from './formula/hooks';

export * from './formula/enums';
export * from './formula/error';
export * from './formula/formulas';
export * from './formula/handle-formula-error';
export * from './formula/hooks';
export * from './formula/operators';
export * from './formula/types';
export * from './formula/validate-extract-tree';

export async function substituteColumnAliasWithIdInFormula(
  formula,
  columns: ColumnType[]
) {
  const substituteId = async (pt: any) => {
    if (pt.type === 'CallExpression') {
      for (const arg of pt.arguments || []) {
        await substituteId(arg);
      }
    } else if (pt.type === 'Literal') {
      return;
    } else if (pt.type === 'Identifier') {
      const colNameOrId = pt.name;
      const column = columns.find(
        (c) =>
          c.id === colNameOrId ||
          c.column_name === colNameOrId ||
          c.title === colNameOrId
      );
      pt.name = '{' + column.id + '}';
    } else if (pt.type === 'BinaryExpression') {
      await substituteId(pt.left);
      await substituteId(pt.right);
    }
  };
  // register jsep curly hook
  jsep.plugins.register(jsepCurlyHook);
  const parsedFormula = jsep(formula);
  await substituteId(parsedFormula);
  return jsepTreeToFormula(parsedFormula);
}

export function substituteColumnIdWithAliasInFormula(
  formula,
  columns: ColumnType[],
  rawFormula?
) {
  const substituteId = (pt: any, ptRaw?: any) => {
    if (pt.type === 'CallExpression') {
      let i = 0;
      for (const arg of pt.arguments || []) {
        substituteId(arg, ptRaw?.arguments?.[i++]);
      }
    } else if (pt.type === 'Literal') {
      return;
    } else if (pt.type === 'Identifier') {
      const colNameOrId = pt?.name;
      const column = columns.find(
        (c) =>
          c.id === colNameOrId ||
          c.column_name === colNameOrId ||
          c.title === colNameOrId
      );
      pt.name = column?.title || ptRaw?.name || pt?.name;
    } else if (pt.type === 'BinaryExpression') {
      substituteId(pt.left, ptRaw?.left);
      substituteId(pt.right, ptRaw?.right);
    }
  };

  // register jsep curly hook
  jsep.plugins.register(jsepCurlyHook);
  const parsedFormula = jsep(formula);
  const parsedRawFormula = rawFormula && jsep(rawFormula);
  substituteId(parsedFormula, parsedRawFormula);
  return jsepTreeToFormula(parsedFormula);
}

// isCallExpId - is the identifier part of a call expression
// in case of call expression, we don't want to wrap the identifier in curly brackets
export function jsepTreeToFormula(node, isCallExpId = false) {
  if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
    return (
      '(' +
      jsepTreeToFormula(node.left) +
      ' ' +
      node.operator +
      ' ' +
      jsepTreeToFormula(node.right) +
      ')'
    );
  }

  if (node.type === 'UnaryExpression') {
    return node.operator + jsepTreeToFormula(node.argument);
  }

  if (node.type === 'MemberExpression') {
    return (
      jsepTreeToFormula(node.object) +
      '[' +
      jsepTreeToFormula(node.property) +
      ']'
    );
  }

  if (node.type === 'Identifier') {
    if (!isCallExpId) return '{' + node.name + '}';
    return node.name;
  }

  if (node.type === 'Literal') {
    if (typeof node.value === 'string') {
      return String.raw`"${escapeLiteral(node.raw.slice(1, -1))}"`;
    }
    return '' + node.value;
  }

  if (node.type === 'CallExpression') {
    return (
      jsepTreeToFormula(node.callee, true) +
      '(' +
      node.arguments.map((argPt) => jsepTreeToFormula(argPt)).join(', ') +
      ')'
    );
  }

  if (node.type === 'ArrayExpression') {
    return (
      '[' +
      node.elements.map((elePt) => jsepTreeToFormula(elePt)).join(', ') +
      ']'
    );
  }

  if (node.type === 'Compound') {
    return node.body.map((e) => jsepTreeToFormula(e)).join(' ');
  }

  if (node.type === 'ConditionalExpression') {
    return (
      jsepTreeToFormula(node.test) +
      ' ? ' +
      jsepTreeToFormula(node.consequent) +
      ' : ' +
      jsepTreeToFormula(node.alternate)
    );
  }

  return '';
}

function escapeLiteral(v: string) {
  return (
    v
      // replace \ to \\, escape only unescaped \
      .replace(/([^\\]|^)\\(?!\\)/g, `$1\\\\`)
      // replace " to \"
      .replace(/([^\\]|^)"/g, `$1\\"`)
      // replace ' to \'
      .replace(/([^\\]|^)'/g, `$1\\'`)
  );
}
