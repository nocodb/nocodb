import { ColumnType } from './Api';
import { formulaJsep } from './formula/jsepInstances';
import { isCurlyIdentifier } from './formula/hooks';
import {
  canBeDotPathHop,
  findColumnByRef,
  getMemberPath,
} from './formula/member-path';

export * from './formula/enums';
export * from './formula/error';
export * from './formula/formulas';
export * from './formula/handle-formula-error';
export * from './formula/hooks';
export * from './formula/operators';
export * from './formula/types';
export * from './formula/validate-extract-tree';
export * from './formula/jsepInstances';
export * from './formula/non-finite';
export * from './formula/array-date-ref';
export * from './formula/url-markup';
export * from './formula/member-path';
export * from './formula/method-scope';
export * from './formula/rollupFormula';

// Columns of the table a link field points to, for resolving `{Link}.{Field}`
export type RelatedColumnsResolver<R = ColumnType[] | undefined> = (
  linkColumn: ColumnType
) => R;

// Operand nodes that can hold a field reference. A CallExpression callee and a
// MemberExpression property are names, not fields, so they are left out.
function formulaChildNodes(pt: any): any[] {
  switch (pt?.type) {
    case 'CallExpression':
      return pt.arguments || [];
    case 'UnaryExpression':
      return [pt.argument];
    case 'BinaryExpression':
    case 'LogicalExpression':
      return [pt.left, pt.right];
    case 'ArrayExpression':
      return (pt.elements || []).filter(Boolean);
    case 'Compound':
      return pt.body || [];
    case 'ConditionalExpression':
      return [pt.test, pt.consequent, pt.alternate];
    case 'MemberExpression':
      return [pt.object];
    default:
      return [];
  }
}

export async function substituteColumnAliasWithIdInFormula(
  formula,
  columns: ColumnType[],
  getRelatedColumns?: RelatedColumnsResolver<
    ColumnType[] | undefined | Promise<ColumnType[] | undefined>
  >
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
      const column = findColumnByRef(columns, colNameOrId);
      // Leave an unresolvable reference as-is instead of crashing on
      // `column.id` — the downstream formula validation then surfaces a clean
      // "column not found" error rather than a raw TypeError 500.
      pt.name = column ? '{' + column.id + '}' : pt.name;
    } else if (pt.type === 'MemberExpression') {
      const path = getMemberPath(pt);
      // e.g. `{Hours}.SUM`, left for validation to reject
      if (!path) return substituteId(pt.object);
      let hopColumns = columns;
      for (let i = 0; i < path.length; i++) {
        const column = findColumnByRef(hopColumns, path[i].name);
        if (!column) break;
        path[i].name = '{' + column.id + '}';
        if (i === path.length - 1) break;
        hopColumns =
          canBeDotPathHop(column) && getRelatedColumns
            ? await getRelatedColumns(column)
            : undefined;
      }
    } else {
      for (const child of formulaChildNodes(pt)) {
        await substituteId(child);
      }
    }
  };
  const parsedFormula = formulaJsep(formula);
  await substituteId(parsedFormula);
  return jsepTreeToFormula(parsedFormula);
}

export function substituteColumnIdWithAliasInFormula(
  formula,
  columns: ColumnType[],
  rawFormula?,
  getRelatedColumns?: RelatedColumnsResolver
) {
  const substituteId = (pt: any, ptRaw?: any) => {
    if (pt.type === 'Literal') {
      return;
    } else if (pt.type === 'Identifier') {
      const colNameOrId = pt?.name;
      const column = findColumnByRef(columns, colNameOrId);
      pt.name = column?.title || ptRaw?.name || pt?.name;
    } else if (pt.type === 'MemberExpression') {
      const path = getMemberPath(pt);
      if (!path) return substituteId(pt.object, ptRaw?.object);
      const rawPath = ptRaw && getMemberPath(ptRaw);
      let hopColumns = columns;
      for (let i = 0; i < path.length; i++) {
        const column = findColumnByRef(hopColumns, path[i].name);
        path[i].name = column?.title || rawPath?.[i]?.name || path[i].name;
        hopColumns =
          column && canBeDotPathHop(column)
            ? getRelatedColumns?.(column)
            : undefined;
      }
    } else {
      const rawChildren = ptRaw ? formulaChildNodes(ptRaw) : [];
      formulaChildNodes(pt).forEach((child, i) =>
        substituteId(child, rawChildren[i])
      );
    }
  };

  const parsedFormula = formulaJsep(formula);
  const parsedRawFormula = rawFormula && formulaJsep(rawFormula);
  substituteId(parsedFormula, parsedRawFormula);
  return jsepTreeToFormula(parsedFormula);
}

const isBinaryNode = (node) =>
  node?.type === 'BinaryExpression' || node?.type === 'LogicalExpression';

const binaryPrecedence = (node) => formulaJsep.binary_ops[node.operator] ?? 0;

// Parentheses only where precedence needs them, so `{A} * {B} / 100` prints back as typed
function binaryOperandToFormula(child, parent, isRight: boolean) {
  const text = jsepTreeToFormula(child);
  if (!isBinaryNode(child)) return text;
  const childPrecedence = binaryPrecedence(child);
  const parentPrecedence = binaryPrecedence(parent);
  const needsParens =
    childPrecedence < parentPrecedence ||
    // `{A} - ({B} - {C})` keeps its grouping; operators are left-associative
    (isRight &&
      childPrecedence === parentPrecedence &&
      !formulaJsep.right_associative.has(parent.operator));
  return needsParens ? `(${text})` : text;
}

// isCallExpId - is the identifier part of a call expression
// in case of call expression, we don't want to wrap the identifier in curly brackets
export function jsepTreeToFormula(node, isCallExpId = false) {
  if (isBinaryNode(node)) {
    return (
      binaryOperandToFormula(node.left, node, false) +
      ' ' +
      node.operator +
      ' ' +
      binaryOperandToFormula(node.right, node, true)
    );
  }

  if (node.type === 'UnaryExpression') {
    const argument = jsepTreeToFormula(node.argument);
    return (
      node.operator + (isBinaryNode(node.argument) ? `(${argument})` : argument)
    );
  }

  if (node.type === 'MemberExpression') {
    if (!node.computed) {
      // `{Hours}.SUM` stays as written so validation can reject it
      const property = isCurlyIdentifier(node.property)
        ? jsepTreeToFormula(node.property)
        : jsepTreeToFormula(node.property, true);
      return jsepTreeToFormula(node.object) + '.' + property;
    }
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

  if (node.type === 'CallExpression' && node.chained && node.arguments.length) {
    const [target, ...rest] = node.arguments;
    let targetFormula = jsepTreeToFormula(target);
    // `1.ROUND()` would read as a number, `{A} + {B}.ROUND()` would round only {B}
    if (
      target.type === 'Literal' ||
      target.type === 'UnaryExpression' ||
      isBinaryNode(target)
    ) {
      targetFormula = '(' + targetFormula + ')';
    }
    return (
      targetFormula +
      '.' +
      jsepTreeToFormula(node.callee, true) +
      '(' +
      rest.map((argPt) => jsepTreeToFormula(argPt)).join(', ') +
      ')'
    );
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
      // 1️⃣ Temporarily protect real newline
      .replace(/\\n/g, '__NC_NEWLINE__')

      // 2️⃣ Escape unescaped backslashes (replace \ to \\, escape only unescaped \); keep \" and \' as escaped quotes
      .replace(/([^\\]|^)\\(?![\\"'])/g, `$1\\\\`)

      // 3️⃣ Escape quotes (replace " to \" and ' to \')
      .replace(/([^\\]|^)"/g, `$1\\"`)
      .replace(/([^\\]|^)'/g, `$1\\'`)

      // 4️⃣ Restore protected newline and tab
      .replace(/__NC_NEWLINE__/g, '\\n')
  );
}
