import jsep from 'jsep';

import { ColumnType } from './Api';

export const jsepCurlyHook = {
  name: 'curly',
  init(jsep) {
    jsep.hooks.add('gobble-token', function gobbleCurlyLiteral(env) {
      const OCURLY_CODE = 123; // {
      const CCURLY_CODE = 125; // }
      let start = -1;
      const { context } = env;
      if (
        !jsep.isIdentifierStart(context.code) &&
        context.code === OCURLY_CODE
      ) {
        if (start == -1) {
          start = context.index;
        }
        context.index += 1;
        context.gobbleExpressions(CCURLY_CODE);
        if (context.code === CCURLY_CODE) {
          context.index += 1;
          env.node = {
            type: jsep.IDENTIFIER,
            name: /{{(.*?)}}/.test(context.expr)
              ? // start would be the position of the first curly bracket
                // add 2 to point to the first character for expressions like {{col1}}
                context.expr.slice(start + 2, context.index - 1)
              : // start would be the position of the first curly bracket
                // add 1 to point to the first character for expressions like {col1}
                context.expr.slice(start + 1, context.index - 1),
          };
          return env.node;
        } else {
          context.throwError('Unclosed }');
        }
      }
    });
  },
} as jsep.IPlugin;

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

export function jsepTreeToFormula(node) {
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
    const formulas = [
      'AVG',
      'ADD',
      'DATEADD',
      'DATETIME_DIFF',
      'WEEKDAY',
      'AND',
      'OR',
      'CONCAT',
      'TRIM',
      'UPPER',
      'LOWER',
      'LEN',
      'MIN',
      'MAX',
      'CEILING',
      'FLOOR',
      'ROUND',
      'MOD',
      'REPEAT',
      'LOG',
      'EXP',
      'POWER',
      'SQRT',
      'SQRT',
      'ABS',
      'NOW',
      'REPLACE',
      'SEARCH',
      'INT',
      'RIGHT',
      'LEFT',
      'SUBSTR',
      'MID',
      'IF',
      'SWITCH',
      'URL',
    ];
    if (!formulas.includes(node.name.toUpperCase())) return '{' + node.name + '}';
    return node.name;
  }

  if (node.type === 'Literal') {
    if (typeof node.value === 'string') {
      return String.raw`"${escapeLiteral(node.value)}"`;
    }
    return '' + node.value;
  }

  if (node.type === 'CallExpression') {
    return (
      jsepTreeToFormula(node.callee) +
      '(' +
      node.arguments.map(jsepTreeToFormula).join(', ') +
      ')'
    );
  }

  if (node.type === 'ArrayExpression') {
    return '[' + node.elements.map(jsepTreeToFormula).join(', ') + ']';
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
      // replace \ to \\
      .replace(/\\/g, `\\\\`)
      // replace " to \"
      .replace(/"/g, `\\"`)
      // replace ' to \'
      .replace(/'/g, `\\'`)
  );
}
