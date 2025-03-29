import {
  type CallExpressionNode,
  ComparisonOperators,
  FormulaDataTypes,
  JSEPNode,
  type ParsedFormulaNode,
  UITypes,
  validateDateWithUnknownFormat,
} from 'nocodb-sdk';
import { convertDateFormatForConcat } from 'src/helpers/formulaFnHelper';
import mapFunctionName from '../mapFunctionName';
import type {
  BinaryExpressionNode,
  ComparisonOperator,
  IdentifierNode,
  LiteralNode,
  NcContext,
} from 'nocodb-sdk';
import type { Model } from 'src/models';
import type {
  FnParsedTreeNode,
  TAliasToColumn,
} from './formula-query-builder.types';
import type CustomKnex from '../CustomKnex';

export const callExpressionBuilder = async ({
  context,
  pt,
  fn,
  prevBinaryOp,
  aliasToColumn,
  knex,
  model,
  columnIdToUidt,
}: {
  context: NcContext;
  pt: CallExpressionNode;
  fn: (
    pt: FnParsedTreeNode,
    prevBinaryOp?: string,
  ) => undefined | Promise<{ builder: any }>;
  prevBinaryOp: string;
  aliasToColumn: TAliasToColumn;
  knex: CustomKnex;
  model: Model;
  columnIdToUidt: Record<string, UITypes>;
}): Promise<{ builder: any }> => {
  switch (pt.callee.name.toUpperCase()) {
    case 'ADD':
    case 'SUM':
      if (pt.arguments.length > 1) {
        return fn(
          {
            type: JSEPNode.BINARY_EXP,
            operator: '+',
            left: {
              type: JSEPNode.CALL_EXP,
              callee: { type: 'Identifier', name: 'COALESCE' },
              arguments: [
                pt.arguments[0],
                { type: JSEPNode.LITERAL, value: 0 } as ParsedFormulaNode,
              ],
            },
            right: { ...pt, arguments: pt.arguments.slice(1) },
          },
          prevBinaryOp,
        );
      } else {
        return fn(
          {
            type: JSEPNode.CALL_EXP,
            callee: { type: 'Identifier', name: 'COALESCE' },
            arguments: [
              pt.arguments[0],
              { type: JSEPNode.LITERAL, value: 0 } as ParsedFormulaNode,
            ],
          },
          prevBinaryOp,
        );
      }
      break;
    case 'CONCAT':
      if (knex.clientType() === 'sqlite3') {
        if (pt.arguments.length > 1) {
          return fn(
            {
              type: JSEPNode.BINARY_EXP,
              operator: '||',
              left: pt.arguments[0],
              right: { ...pt, arguments: pt.arguments.slice(1) },
            },
            prevBinaryOp,
          );
        } else {
          return fn(pt.arguments[0], prevBinaryOp);
        }
      } else if (knex.clientType() === 'databricks') {
        const res = await mapFunctionName({
          pt,
          knex,
          aliasToCol: aliasToColumn,
          fn,
          prevBinaryOp,
          model,
        });
        if (res) return res;
      }
      break;
    case 'URL':
      /**
       * Added extra whitespace around URI and LABEL content to avoid conflicts during regex parsing.
       *
       * Reason for Adding Whitespace:
       * - Our URI syntax uses parentheses `(` and `)` to wrap URL and label content.
       * - Escaped parentheses `\(` and `\)` are allowed inside content, but without extra space,
       *   trailing backslashes (e.g., `\)`) near the closing parenthesis can cause incomplete group matches.
       * - Adding leading and trailing spaces around the content (`URI::( ` and ` )`) ensures that
       *   closing parentheses after escaped characters are parsed correctly.
       *
       * Example Case:
       * - Without space: `URI::(https://github.com/nocodb/nocodb/pull/10707\)`
       *   - Results in incomplete or invalid group matches.
       * - With space: `URI::( https://github.com/nocodb/nocodb/pull/10707\ )`
       *   - Handles escaped characters and parses content as expected.
       *
       * How It Works:
       * - The backend adds a leading space after `URI::(` and before the closing `)`.
       * - For labels, a leading space is added after `LABEL::(` and before `)`.
       * - The frontend regex is updated to accommodate these changes.
       *
       */
      return fn(
        {
          type: JSEPNode.CALL_EXP,
          arguments: [
            {
              type: JSEPNode.LITERAL,
              value: 'URI::( ',
              raw: '"URI::( "',
            },
            // wrap with replace function to escape parenthesis since it has special meaning in our URI syntax
            {
              type: JSEPNode.CALL_EXP,
              arguments: [
                {
                  type: JSEPNode.CALL_EXP,
                  arguments: [
                    pt.arguments[0],
                    {
                      type: JSEPNode.LITERAL,
                      value: '(',
                      raw: '"("',
                    },
                    {
                      type: JSEPNode.LITERAL,
                      value: '\\(',
                      raw: '"\\("',
                    },
                  ],
                  callee: {
                    type: 'Identifier',
                    name: 'REPLACE',
                  },
                },
                {
                  type: JSEPNode.LITERAL,
                  value: ')',
                  raw: '")"',
                },
                {
                  type: JSEPNode.LITERAL,
                  value: '\\)',
                  raw: '"\\)"',
                },
              ],
              callee: {
                type: 'Identifier',
                name: 'REPLACE',
              },
            },
            {
              type: JSEPNode.LITERAL,
              value: ' )',
              raw: '" )"',
            },
            ...(pt.arguments[1]
              ? ([
                  {
                    type: JSEPNode.LITERAL,
                    value: ' LABEL::( ',
                    raw: ' LABEL::( ',
                  },

                  // wrap with replace function to escape parenthesis since it has special meaning in our URI syntax
                  {
                    type: JSEPNode.CALL_EXP,
                    arguments: [
                      {
                        type: JSEPNode.CALL_EXP,
                        arguments: [
                          pt.arguments[1],
                          {
                            type: JSEPNode.LITERAL,
                            value: '(',
                            raw: '"("',
                          },
                          {
                            type: JSEPNode.LITERAL,
                            value: '\\(',
                            raw: '"\\("',
                          },
                        ],
                        callee: {
                          type: 'Identifier',
                          name: 'REPLACE',
                        },
                      },
                      {
                        type: JSEPNode.LITERAL,
                        value: ')',
                        raw: '")"',
                      },
                      {
                        type: JSEPNode.LITERAL,
                        value: '\\)',
                        raw: '"\\)"',
                      },
                    ],
                    callee: {
                      type: 'Identifier',
                      name: 'REPLACE',
                    },
                  },
                  {
                    type: JSEPNode.LITERAL,
                    value: ' )',
                    raw: '" )"',
                  },
                ] as ParsedFormulaNode[])
              : ([] as ParsedFormulaNode[])),
          ],
          callee: {
            type: 'Identifier',
            name: 'CONCAT',
          },
        },
        prevBinaryOp,
      );
      break;
    default:
      {
        const res = await mapFunctionName({
          pt,
          knex,
          aliasToCol: aliasToColumn,
          fn,
          prevBinaryOp,
          model,
        });
        if (res) return res;
      }
      break;
  }

  const calleeName = pt.callee.name.toUpperCase();
  const callArgs = (
    await Promise.all(
      pt.arguments.map(async (arg) => {
        let query = (await fn(arg)).builder.toQuery();
        if (calleeName === 'CONCAT') {
          if (knex.clientType() !== 'sqlite3') {
            query = await convertDateFormatForConcat(
              context,
              arg,
              columnIdToUidt,
              query,
              knex.clientType(),
            );
          } else {
            // sqlite3: special handling - See BinaryExpression
          }

          if (knex.clientType() === 'mysql2') {
            // mysql2: CONCAT() returns NULL if any argument is NULL.
            // adding IFNULL to convert NULL values to empty strings
            return `IFNULL(${query}, '')`;
          } else {
            // do nothing
            // pg / mssql: Concatenate all arguments. NULL arguments are ignored.
            // sqlite3: special handling - See BinaryExpression
          }
        }
        return query;
      }),
    )
  ).join();
  return {
    builder: knex.raw(`${calleeName}(${callArgs})`.replace(/\?/g, '\\?')),
  };
};

export const binaryExpressionBuilder = async ({
  context,
  pt,
  fn,
  prevBinaryOp,
  knex,
  columnIdToUidt,
  aliasToColumn,
  model,
}: {
  context: NcContext;
  pt: BinaryExpressionNode;
  fn: (
    pt: FnParsedTreeNode,
    prevBinaryOp?: string,
  ) => undefined | Promise<{ builder: any }>;
  prevBinaryOp: string;
  knex: CustomKnex;
  columnIdToUidt: Record<string, UITypes>;
  aliasToColumn: TAliasToColumn;
  model: Model;
}) => {
  // treat `&` as shortcut for concat
  if (pt.operator === '&') {
    return fn(
      {
        type: JSEPNode.CALL_EXP,
        arguments: [pt.left, pt.right],
        callee: {
          type: 'Identifier',
          name: 'CONCAT',
        },
      },
      prevBinaryOp,
    );
  }

  // if operator is + and expected return type is string, convert to concat
  if (pt.operator === '+' && pt.dataType === FormulaDataTypes.STRING) {
    return fn(
      {
        type: JSEPNode.CALL_EXP,
        arguments: [pt.left, pt.right],
        callee: {
          type: 'Identifier',
          name: 'CONCAT',
        },
      },
      prevBinaryOp,
    );
  }

  // if operator is == or !=, then handle comparison with BLANK which should accept NULL and empty string
  if (pt.operator === '==' || pt.operator === '!=') {
    for (const operand of ['left', 'right']) {
      if (
        pt[operand].dataType === FormulaDataTypes.BOOLEAN &&
        pt[operand === 'left' ? 'right' : 'left'].dataType ===
          FormulaDataTypes.NUMERIC
      ) {
        pt[operand === 'left' ? 'right' : 'left'] = {
          type: JSEPNode.CALL_EXP,
          arguments: [pt[operand === 'left' ? 'right' : 'left']],
          callee: {
            type: 'Identifier',
            name: 'BOOLEAN',
          },
          dataType: FormulaDataTypes.BOOLEAN,
        };
      }
    }
    if (
      (pt.left as CallExpressionNode).callee?.name !==
      (pt.right as CallExpressionNode).callee?.name
    ) {
      // if left/right is BLANK, accept both NULL and empty string
      for (const operand of ['left', 'right']) {
        if (
          pt[operand].type === 'CallExpression' &&
          pt[operand].callee.name === 'BLANK'
        ) {
          const isString =
            pt[operand === 'left' ? 'right' : 'left'].dataType ===
            FormulaDataTypes.STRING;
          let calleeName;

          if (pt.operator === '==') {
            calleeName = isString ? 'ISBLANK' : 'ISNULL';
          } else {
            calleeName = isString ? 'ISNOTBLANK' : 'ISNOTNULL';
          }

          return fn(
            {
              type: JSEPNode.CALL_EXP,
              arguments: [operand === 'left' ? pt.right : pt.left],
              callee: {
                type: 'Identifier',
                name: calleeName,
              },
            },
            prevBinaryOp,
          );
        }
      }
    }
  }

  if (pt.operator === '==') {
    pt.operator = '=';
    // if left/right is of different type, convert to string and compare
    if (
      pt.left.dataType !== pt.right.dataType &&
      [pt.left.dataType, pt.right.dataType].every(
        (type) => type !== FormulaDataTypes.NULL,
      )
    ) {
      pt.left = {
        type: JSEPNode.CALL_EXP,
        arguments: [pt.left],
        callee: {
          type: 'Identifier',
          name: 'STRING',
        },
      };
      pt.right = {
        type: JSEPNode.CALL_EXP,
        arguments: [pt.right],
        callee: {
          type: 'Identifier',
          name: 'STRING',
        },
      };
    }
  }

  if (pt.operator === '/') {
    pt.left = {
      callee: { name: 'FLOAT' },
      type: JSEPNode.CALL_EXP,
      arguments: [pt.left],
    };
    pt.right = {
      callee: { name: 'FLOAT' },
      type: JSEPNode.CALL_EXP,
      arguments: [pt.right],
    };
  }
  (pt.left as FnParsedTreeNode).fnName =
    (pt.left as FnParsedTreeNode).fnName || 'ARITH';
  (pt.right as FnParsedTreeNode).fnName =
    (pt.right as FnParsedTreeNode).fnName || 'ARITH';

  let left = (await fn(pt.left, pt.operator)).builder.toQuery();
  let right = (await fn(pt.right, pt.operator)).builder.toQuery();
  let sql = `${left} ${pt.operator} ${right}`;

  if (ComparisonOperators.includes(pt.operator as ComparisonOperator)) {
    // comparing a date with empty string would throw
    // `ERROR: zero-length delimited identifier` in Postgres
    if (
      knex.clientType() === 'pg' &&
      columnIdToUidt[(pt.left as IdentifierNode).name] === UITypes.Date
    ) {
      // The correct way to compare with Date should be using
      // `IS_AFTER`, `IS_BEFORE`, or `IS_SAME`
      // This is to prevent empty data returned to UI due to incorrect SQL
      if ((pt.right as LiteralNode).value === '') {
        if (pt.operator === '=') {
          sql = `${left} IS NULL `;
        } else {
          sql = `${left} IS NOT NULL `;
        }
      } else if (
        !validateDateWithUnknownFormat(
          (pt.right as LiteralNode).value as string,
        )
      ) {
        // left tree value is date but right tree value is not date
        // return true if left tree value is not null, else false
        sql = `${left} IS NOT NULL `;
      }
    }
    if (
      knex.clientType() === 'pg' &&
      columnIdToUidt[(pt.right as IdentifierNode).name] === UITypes.Date
    ) {
      // The correct way to compare with Date should be using
      // `IS_AFTER`, `IS_BEFORE`, or `IS_SAME`
      // This is to prevent empty data returned to UI due to incorrect SQL
      if ((pt.left as LiteralNode).value === '') {
        if (pt.operator === '=') {
          sql = `${right} IS NULL `;
        } else {
          sql = `${right} IS NOT NULL `;
        }
      } else if (
        !validateDateWithUnknownFormat((pt.left as LiteralNode).value as string)
      ) {
        // right tree value is date but left tree value is not date
        // return true if right tree value is not null, else false
        sql = `${right} IS NOT NULL `;
      }
    }
  }

  if (
    (pt.left as FnParsedTreeNode).fnName === 'CONCAT' &&
    knex.clientType() === 'sqlite3'
  ) {
    // handle date format
    left = await convertDateFormatForConcat(
      context,
      (pt.left as CallExpressionNode)?.arguments?.[0],
      columnIdToUidt,
      left,
      knex.clientType(),
    );
    right = await convertDateFormatForConcat(
      context,
      (pt.right as CallExpressionNode)?.arguments?.[0],
      columnIdToUidt,
      right,
      knex.clientType(),
    );

    // handle NULL values when calling CONCAT for sqlite3
    sql = `COALESCE(${left}, '') ${pt.operator} COALESCE(${right},'')`;
  }

  if (knex.clientType() === 'mysql2') {
    sql = `IFNULL(${left} ${pt.operator} ${right}, ${
      pt.operator === '='
        ? pt.left.type === 'Literal'
          ? (pt.left as LiteralNode).value === ''
          : (pt.right as LiteralNode).value === ''
        : pt.operator === '!='
        ? pt.left.type !== 'Literal'
          ? (pt.left as any).value === ''
          : (pt.right as any).value === ''
        : 0
    })`;
  } else if (
    knex.clientType() === 'sqlite3' ||
    knex.clientType() === 'pg' ||
    knex.clientType() === 'mssql'
  ) {
    if (pt.operator === '=') {
      if (pt.left.type === 'Literal' && pt.left.value === '') {
        sql = `${right} IS NULL OR CAST(${right} AS TEXT) = ''`;
      } else if (pt.right.type === 'Literal' && pt.right.value === '') {
        sql = `${left} IS NULL OR CAST(${left} AS TEXT) = ''`;
      }
    } else if (pt.operator === '!=') {
      if (pt.left.type === 'Literal' && pt.left.value === '') {
        sql = `${right} IS NOT NULL AND CAST(${right} AS TEXT) != ''`;
      } else if (pt.right.type === 'Literal' && pt.right.value === '') {
        sql = `${left} IS NOT NULL AND CAST(${left} AS TEXT) != ''`;
      }
    }

    if (
      (pt.operator === '=' || pt.operator === '!=') &&
      prevBinaryOp !== 'AND' &&
      prevBinaryOp !== 'OR'
    ) {
      sql = `(CASE WHEN ${sql} THEN true ELSE false END )`;
    } else if (pt.operator === '/') {
      // handle divide by zero
      const right = await callExpressionBuilder({
        context,
        pt: {
          callee: { name: 'NULLIF', type: 'Identifier' },
          dataType: FormulaDataTypes.NUMERIC,
          type: JSEPNode.CALL_EXP,
          arguments: [
            pt.right,
            {
              type: JSEPNode.LITERAL,
              dataType: FormulaDataTypes.NUMERIC,
              value: 0,
              raw: '0',
            },
          ],
        } as CallExpressionNode,
        fn,
        prevBinaryOp,
        aliasToColumn,
        knex,
        model,
        columnIdToUidt,
      });
      sql = `${left} ${pt.operator} ${right.builder}`;
    } else {
      sql = `${sql} `;
    }
  }
  const query = knex.raw(sql.replace(/\?/g, '\\?'));
  if (prevBinaryOp && pt.operator !== prevBinaryOp) {
    query.wrap('(', ')');
  }
  return { builder: query };
};
