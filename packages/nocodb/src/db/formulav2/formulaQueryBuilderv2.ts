import { Logger } from '@nestjs/common';
import jsep from 'jsep';
import {
  FormulaDataTypes,
  jsepCurlyHook,
  JSEPNode,
  LongTextAiMetaProp,
  NcErrorType,
  UITypes,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk';
import genRollupSelectv2 from '../genRollupSelectv2';
import { lookupOrLtarBuilder } from './lookup-or-ltar-builder';
import {
  binaryExpressionBuilder,
  callExpressionBuilder,
} from './parsed-tree-builder';
import type { LiteralNode } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { User } from '~/models';
import type Column from '~/models/Column';
import type RollupColumn from '~/models/RollupColumn';
import type {
  FnParsedTreeNode,
  FormulaQueryBuilderBaseParams,
  TAliasToColumn,
} from './formula-query-builder.types';
import NocoCache from '~/cache/NocoCache';
import { getRefColumnIfAlias } from '~/helpers';
import { ExternalTimeout, NcBaseErrorv2, NcError } from '~/helpers/catchError';
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
    getAliasCount,
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
              getAliasCount,
              column: col,
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
          ...params,
          column: col,
          _formulaQueryBuilder,
          knex,
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
      return await callExpressionBuilder({
        context,
        pt,
        fn,
        aliasToColumn,
        columnIdToUidt,
        knex,
        model,
        prevBinaryOp,
      });
    } else if (pt.type === 'Literal') {
      return { builder: knex.raw(`?`, [pt.value]) };
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
      return await binaryExpressionBuilder({
        context,
        pt,
        fn,
        columnIdToUidt,
        knex,
        prevBinaryOp,
        aliasToColumn,
        model,
      });
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
  aliasToColumn?: TAliasToColumn;
  tableAlias?: string;
  validateFormula?: boolean;
  parsedTree?: any;
  baseUsers?: (Partial<User> & BaseUser)[];
}) {
  const knex = baseModelSqlv2.dbDriver;

  const context = baseModelSqlv2.context;

  // register jsep curly hook once only
  jsep.plugins.register(jsepCurlyHook);
  const formulaContext = {
    count: 0,
  };
  const getAliasCount = () => {
    const result = formulaContext.count++;
    return result;
  };

  let qb;
  try {
    // generate qb
    qb = await _formulaQueryBuilder({
      baseModelSqlv2,
      _tree,
      model,
      aliasToColumn,
      tableAlias,
      column,
      parsedTree:
        parsedTree ??
        (await column
          ?.getColOptions<FormulaColumn | ButtonColumn>(context)
          .then((formula) => formula?.getParsedTree())),
      baseUsers,
      parentColumns: new Set(column?.id ? [column?.id] : []),
      getAliasCount,
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
