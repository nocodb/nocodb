import {
  type CallExpressionNode,
  JSEPNode,
  type ParsedFormulaNode,
} from 'nocodb-sdk';
import { convertDateFormatForConcat } from 'src/helpers/formulaFnHelper';
import mapFunctionName from '../mapFunctionName';
import type { NcContext, UITypes } from 'nocodb-sdk';
import type { Model } from 'src/models';
import type { TAliasToColumn } from './formula-query-builder.types';
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
  fn: any;
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
