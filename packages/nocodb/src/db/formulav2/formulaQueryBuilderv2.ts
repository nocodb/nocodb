import { Logger } from '@nestjs/common';
import jsep from 'jsep';
import {
  ComparisonOperators,
  FormulaDataTypes,
  jsepCurlyHook,
  JSEPNode,
  LongTextAiMetaProp,
  NcErrorType,
  UITypes,
  validateDateWithUnknownFormat,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk';
import genRollupSelectv2 from '../genRollupSelectv2';
import mapFunctionName from '../mapFunctionName';
import { lookupOrLtarBuilder } from './lookup-or-ltar-builder';
import type {
  CallExpressionNode,
  ComparisonOperator,
  IdentifierNode,
  LiteralNode,
  ParsedFormulaNode,
} from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { User } from '~/models';
import type Column from '~/models/Column';
import type RollupColumn from '~/models/RollupColumn';
import type {
  FnParsedTreeNode,
  FormulaQueryBuilderBaseParams,
  TAliasToClumn,
} from './formula-query-builder.types';
import NocoCache from '~/cache/NocoCache';
import { getRefColumnIfAlias } from '~/helpers';
import { ExternalTimeout, NcBaseErrorv2, NcError } from '~/helpers/catchError';
import { convertDateFormatForConcat } from '~/helpers/formulaFnHelper';
import { BaseUser, ButtonColumn } from '~/models';
import FormulaColumn from '~/models/FormulaColumn';
import Model from '~/models/Model';
import { CacheScope } from '~/utils/globals';

const logger = new Logger('FormulaQueryBuilderv2');

async function _formulaQueryBuilder(params: FormulaQueryBuilderBaseParams) {
  const {
    baseModelSqlv2,
    _tree,
    model,
    aliasToColumn = {},
    tableAlias,
    parsedTree,
    column = null,
  } = params;

  let { baseUsers = null } = params;

  const knex = baseModelSqlv2.dbDriver;

  const context = baseModelSqlv2.context;

  const columns = await model.getColumns(context);

  let tree = parsedTree;
  if (!tree) {
    // formula may include double curly brackets in previous version
    // convert to single curly bracket here for compatibility
    // const _tree1 = jsep(_tree.replaceAll('{{', '{').replaceAll('}}', '}'));
    tree = await validateFormulaAndExtractTreeWithType({
      formula: _tree.replaceAll('{{', '{').replaceAll('}}', '}'),
      columns,
      column,
      clientOrSqlUi: baseModelSqlv2.clientType as
        | 'mysql'
        | 'pg'
        | 'sqlite3'
        | 'mssql'
        | 'mysql2'
        | 'oracledb'
        | 'mariadb'
        | 'sqlite'
        | 'snowflake',
      getMeta: async (modelId) => {
        const model = await Model.get(context, modelId);
        await model.getColumns(context);
        return model;
      },
    });

    // populate and save parsedTree to column if not exist
    if (column) {
      if (column.uidt === UITypes.Formula) {
        FormulaColumn.update(context, column.id, { parsed_tree: tree }).then(
          () => {
            // ignore
          },
          (err) => {
            logger.error(err);
          },
        );
      } else {
        ButtonColumn.update(context, column.id, { parsed_tree: tree }).then(
          () => {
            // ignore
          },
          (err) => {
            logger.error(err);
          },
        );
      }
    }
  }

  const columnIdToUidt: Record<string, UITypes> = {};

  // todo: improve - implement a common solution for filter, sort, formula, etc
  for (const col of columns) {
    columnIdToUidt[col.id] = col.uidt;
    if (col.id in aliasToColumn) continue;
    switch (col.uidt) {
      case UITypes.Formula:
      case UITypes.Button:
        {
          aliasToColumn[col.id] = async (parentColumns?: Set<string>) => {
            if (parentColumns?.has(col.id)) {
              NcError.formulaError('Circular reference detected', {
                details: {
                  columnId: col.id,
                  modelId: model.id,
                  parentColumnIds: Array.from(parentColumns),
                },
              });
            }

            const formulOption = await col.getColOptions<
              FormulaColumn | ButtonColumn
            >(context);
            const { builder } = await _formulaQueryBuilder({
              baseModelSqlv2,
              _tree: formulOption.formula,
              model,
              aliasToColumn: { ...aliasToColumn, [col.id]: null },
              tableAlias,
              parsedTree: formulOption.getParsedTree(),
              baseUsers,
              parentColumns: new Set([col.id, ...(parentColumns ?? [])]),
            });
            builder.sql = '(' + builder.sql + ')';
            return {
              builder,
            };
          };
        }
        break;
      case UITypes.Lookup:
      case UITypes.LinkToAnotherRecord:
        aliasToColumn[col.id] = lookupOrLtarBuilder({
          baseModelSqlv2,
          context,
          model,
          col,
          _formulaQueryBuilder,
          knex,
          tableAlias,
          aliasToColumn,
        });
        break;
      case UITypes.Rollup:
      case UITypes.Links:
        aliasToColumn[col.id] = async (
          _parentColumns?: Set<string>,
        ): Promise<any> => {
          const qb = await genRollupSelectv2({
            baseModelSqlv2,
            knex,
            columnOptions: (await col.getColOptions(context)) as RollupColumn,
            alias: tableAlias,
          });
          return { builder: knex.raw(qb.builder).wrap('(', ')') };
        };
        break;
      case UITypes.CreatedTime:
      case UITypes.LastModifiedTime:
      case UITypes.DateTime:
        {
          const refCol = await getRefColumnIfAlias(context, col);

          if (refCol.id in aliasToColumn) {
            aliasToColumn[col.id] = aliasToColumn[refCol.id];
            break;
          }
          if (knex.clientType().startsWith('mysql')) {
            aliasToColumn[col.id] = async (
              _parentColumns?: Set<string>,
            ): Promise<any> => {
              return {
                // convert from DB timezone to UTC
                builder: knex.raw(
                  `CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00')`,
                  [refCol.column_name],
                ),
              };
            };
          } else if (
            knex.clientType() === 'pg' &&
            refCol.dt !== 'timestamp with time zone' &&
            refCol.dt !== 'timestamptz'
          ) {
            aliasToColumn[col.id] = async (
              _parentColumns?: Set<string>,
            ): Promise<any> => {
              return {
                // convert from DB timezone to UTC
                builder: knex
                  .raw(
                    `?? AT TIME ZONE CURRENT_SETTING('timezone') AT TIME ZONE 'UTC'`,
                    [refCol.column_name],
                  )
                  .wrap('(', ')'),
              };
            };
          } else if (
            knex.clientType() === 'mssql' &&
            refCol.dt !== 'datetimeoffset'
          ) {
            // convert from DB timezone to UTC
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                builder: knex.raw(
                  `CONVERT(DATETIMEOFFSET, ?? AT TIME ZONE 'UTC')`,
                  [refCol.column_name],
                ),
              };
            };
          } else {
            aliasToColumn[col.id] = () =>
              Promise.resolve({ builder: refCol.column_name });
          }
          aliasToColumn[refCol.id] = aliasToColumn[col.id];
        }
        break;
      case UITypes.User:
      case UITypes.CreatedBy:
      case UITypes.LastModifiedBy:
        {
          aliasToColumn[col.id] = async (
            _parentColumns?: Set<string>,
          ): Promise<any> => {
            baseUsers =
              baseUsers ??
              (await BaseUser.getUsersList(context, {
                base_id: model.base_id,
              }));

            // create nested replace statement for each user
            const finalStatement = baseUsers.reduce((acc, user) => {
              const qb = knex.raw(`REPLACE(${acc}, ?, ?)`, [
                user.id,
                user.email,
              ]);
              return qb.toQuery();
            }, knex.raw(`??`, [col.column_name]).toQuery());

            return {
              builder: knex.raw(finalStatement).wrap('(', ')'),
            };
          };
        }
        break;
      case UITypes.LongText: {
        if (col.meta?.[LongTextAiMetaProp] === true) {
          if (knex.clientType() === 'pg') {
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                builder: knex.raw(`TRIM('"' FROM (??::jsonb->>'value'))`, [
                  col.column_name,
                ]),
              };
            };
          } else if (knex.clientType().startsWith('mysql')) {
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                builder: knex.raw(`JSON_UNQUOTE(JSON_EXTRACT(??, '$.value'))`, [
                  col.column_name,
                ]),
              };
            };
          } else if (knex.clientType() === 'sqlite3') {
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                builder: knex.raw(`json_extract(??, '$.value')`, [
                  col.column_name,
                ]),
              };
            };
          } else if (knex.clientType() === 'mssql') {
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                builder: knex.raw(`JSON_VALUE(??, '$.value')`, [
                  col.column_name,
                ]),
              };
            };
          }
        } else {
          aliasToColumn[col.id] = () =>
            Promise.resolve({ builder: col.column_name });
        }
        break;
      }
      default:
        aliasToColumn[col.id] = () =>
          Promise.resolve({
            builder: knex.raw(`??`, [
              `${tableAlias ?? baseModelSqlv2.getTnPath(model.table_name)}.${
                col.column_name
              }`,
            ]),
          });
        break;
    }
  }

  const fn = async (pt: FnParsedTreeNode, prevBinaryOp?) => {
    if (pt.type === JSEPNode.CALL_EXP) {
      pt.arguments?.forEach?.((arg: FnParsedTreeNode) => {
        if (arg.fnName) return;
        arg.fnName = pt.callee.name.toUpperCase();
        arg.argsCount = pt.arguments?.length;
      });
    }

    // if cast is string, then wrap with STRING() function
    if (pt.cast === FormulaDataTypes.STRING) {
      return fn(
        {
          type: JSEPNode.CALL_EXP,
          arguments: [{ ...pt, cast: null }],
          callee: {
            type: 'Identifier',
            name: 'STRING',
          },
        },
        prevBinaryOp,
      );
    }

    if (pt.type === JSEPNode.CALL_EXP) {
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
    } else if (pt.type === 'Literal') {
      return { builder: knex.raw(`? `, [pt.value]) };
    } else if (pt.type === 'Identifier') {
      const { builder } =
        (await aliasToColumn?.[pt.name]?.(params.parentColumns)) || {};
      if (typeof builder === 'function') {
        return { builder: knex.raw(`??`, builder(pt.fnName)) };
      }

      if (
        knex.clientType() === 'databricks' &&
        builder.toQuery().endsWith(')')
      ) {
        // limit 1 for subquery
        return {
          builder: knex.raw(`${builder.toQuery().replace(/\)$/, '')} LIMIT 1)`),
        };
      }

      return { builder: knex.raw(`??`, [builder || pt.name]) };
    } else if (pt.type === 'BinaryExpression') {
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
            !validateDateWithUnknownFormat(
              (pt.left as LiteralNode).value as string,
            )
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
        } else {
          sql = `${sql} `;
        }
      }
      const query = knex.raw(sql.replace(/\?/g, '\\?'));
      if (prevBinaryOp && pt.operator !== prevBinaryOp) {
        query.wrap('(', ')');
      }
      return { builder: query };
    } else if (pt.type === 'UnaryExpression') {
      let query;
      if (
        (pt.operator === '-' || pt.operator === '+') &&
        pt.dataType === FormulaDataTypes.NUMERIC
      ) {
        query = knex.raw('?', [
          (pt.operator === '-' ? -1 : 1) *
            ((pt.argument as LiteralNode).value as number),
        ]);
      } else {
        query = knex.raw(
          `${pt.operator}${(
            await fn(pt.argument, pt.operator)
          ).builder.toQuery()}`,
        );
      }

      if (prevBinaryOp && pt.operator !== prevBinaryOp) {
        query.wrap('(', ')');
      }
      return { builder: query };
    }
  };
  const builder = (await fn(tree)).builder;
  return { builder };
}

export default async function formulaQueryBuilderv2({
  baseModel: baseModelSqlv2,
  tree: _tree,
  model,
  column,
  aliasToColumn = {},
  tableAlias,
  validateFormula = false,
  parsedTree,
  baseUsers,
}: {
  baseModel: IBaseModelSqlV2;
  tree;
  model: Model;
  column?: Column;
  aliasToColumn?: TAliasToClumn;
  tableAlias?: string;
  validateFormula?: boolean;
  parsedTree?: any;
  baseUsers?: (Partial<User> & BaseUser)[];
}) {
  const knex = baseModelSqlv2.dbDriver;

  const context = baseModelSqlv2.context;

  // register jsep curly hook once only
  jsep.plugins.register(jsepCurlyHook);
  let qb;
  try {
    // generate qb
    qb = await _formulaQueryBuilder({
      baseModelSqlv2,
      _tree,
      model,
      aliasToColumn,
      tableAlias,
      parsedTree:
        parsedTree ??
        (await column
          ?.getColOptions<FormulaColumn | ButtonColumn>(context)
          .then((formula) => formula?.getParsedTree())),
      baseUsers,
      parentColumns: new Set(column?.id ? [column?.id] : []),
    });

    if (!validateFormula) return qb;

    // dry run qb.builder to see if it will break the grid view or not
    // if so, set formula error and show empty selectQb instead
    await baseModelSqlv2.execAndParse(
      knex(baseModelSqlv2.getTnPath(model, tableAlias))
        .select(knex.raw(`?? as ??`, [qb.builder, '__dry_run_alias']))
        .as('dry-run-only'),
      null,
      { raw: true },
    );

    // if column is provided, i.e. formula has been created
    if (column) {
      const formula = await column.getColOptions<FormulaColumn | ButtonColumn>(
        context,
      );
      // clean the previous formula error if the formula works this time
      if (formula.error) {
        if (formula.constructor.name === 'ButtonColumn') {
          await ButtonColumn.update(context, column.id, {
            error: null,
          });
        } else {
          await FormulaColumn.update(context, column.id, {
            error: null,
          });
        }
      }
    }
  } catch (e) {
    // Mark formula error if formula validation is invoked
    // or if a circular reference error occurs and a column is provided
    if (
      validateFormula ||
      (column?.id &&
        e instanceof NcBaseErrorv2 &&
        e.error === NcErrorType.FORMULA_CIRCULAR_REF_ERROR)
    ) {
      console.error(e);

      if (column) {
        if (column?.uidt === UITypes.Button) {
          await ButtonColumn.update(context, column.id, {
            error: null,
          });
          // update cache to reflect the error in UI
          await NocoCache.update(`${CacheScope.COL_BUTTON}:${column.id}`, {
            error: e.message,
          });
        } else if (!(e instanceof ExternalTimeout)) {
          // add formula error to show in UI
          await FormulaColumn.update(context, column.id, {
            error: e.message,
          });

          // update cache to reflect the error in UI
          await NocoCache.update(`${CacheScope.COL_FORMULA}:${column.id}`, {
            error: e.message,
          });
        }
      }
    } else {
      throw e;
    }

    // if it's a formula error, throw it
    if (e instanceof NcBaseErrorv2) {
      throw e;
    }

    NcError.formulaError(e.message);
  }
  return qb;
}
