import { Logger } from '@nestjs/common';
import {
  CircularRefContext,
  FormulaDataTypes,
  isBtLikeV2Junction,
  JSEPNode,
  LongTextAiMetaProp,
  NcErrorType,
  UITypes,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk';
import { getColumnName } from 'src/helpers/dbHelpers';
import { DBErrorExtractor } from 'src/helpers/db-error/extractor';
import genRollupSelectv2 from '../genRollupSelectv2';
import { lookupOrLtarBuilder } from './lookup-or-ltar-builder';
import {
  binaryExpressionBuilder,
  callExpressionBuilder,
} from './parsed-tree-builder';
import {
  formulaOutputsRawJson,
  getFormulaOutputMaxLength,
  wrapFormulaWithMaxLength,
} from './formula-query-builder.helpers';
import type { ButtonActionsType, ClientType, LiteralNode } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { BarcodeColumn, Model, QrCodeColumn, User } from '~/models';
import type Column from '~/models/Column';
import type RollupColumn from '~/models/RollupColumn';
import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type {
  FnParsedTreeNode,
  FormulaQueryBuilderBaseParams,
  TAliasToColumn,
  TAliasToColumnParam,
} from './formula-query-builder.types';
import { DBQueryClient } from '~/dbQueryClient';
import { isTransientError } from '~/helpers/db-error/utils';
import NocoCache from '~/cache/NocoCache';
import { getRefColumnIfAlias } from '~/helpers';
import { NcBaseErrorv2, NcError } from '~/helpers/catchError';
import { BaseUser, ButtonColumn } from '~/models';
import FormulaColumn from '~/models/FormulaColumn';
import { CacheScope } from '~/utils/globals';
import { TelemetryHandlerService } from '~/services/telemetry-handler.service';
import { getRelatedModelMap } from '~/utils/getRelatedModelMap';

const logger = new Logger('FormulaQueryBuilderv2');

// Sentinel thrown by the dry-run short-circuit below. It is internal control
// flow, not a real formula error, so callers (e.g. select-object.ts) must not
// log it — logging it per record/column is the noise that overwhelms the
// instance when an external source is unreachable.
export const FORMULA_DRY_RUN_SKIPPED_MESSAGE =
  'Skipping formula dry-run: a previous validation already failed';

async function _formulaQueryBuilder(params: FormulaQueryBuilderBaseParams) {
  const {
    baseModelSqlv2,
    _tree,
    model,
    aliasToColumn = {},
    columnIdToUidt = {},
    tableAlias,
    parsedTree,
    column = null,
    columns,
    getAliasCount,
  } = params;

  let { baseUsers = null } = params;

  const knex = baseModelSqlv2.dbDriver;

  const context = baseModelSqlv2.context;

  let tree = parsedTree;
  if (!tree) {
    const relatedModels: Map<string, Model> = await getRelatedModelMap(
      context,
      model,
    );
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
        | 'mysql2'
        | 'mariadb'
        | 'sqlite'
        | 'snowflake',
      getMeta: async (_, { id }) => {
        return relatedModels.get(id);
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

  // todo: improve - implement a common solution for filter, sort, formula, etc
  for (const col of columns) {
    columnIdToUidt[col.id] = col.uidt;
    if (col.id in aliasToColumn) continue;
    switch (col.uidt) {
      case UITypes.Formula:
      case UITypes.Button:
        {
          aliasToColumn[col.id] = async ({
            tableAlias,
            parentColumns,
          }: TAliasToColumnParam) => {
            parentColumns = (
              parentColumns ?? CircularRefContext.make()
            ).cloneAndAdd({
              id: col.id,
              title: col.title,
              table: model.title,
            });

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
              parentColumns,
              getAliasCount,
              column: col,
              columns,
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
        if (col.uidt === UITypes.Links && isBtLikeV2Junction(col)) {
          aliasToColumn[col.id] = lookupOrLtarBuilder({
            ...params,
            column: col,
            _formulaQueryBuilder,
            knex,
          });
          break;
        }
        aliasToColumn[col.id] = async ({
          tableAlias,
          parentColumns: parentColumns,
        }: TAliasToColumnParam): Promise<any> => {
          const qb = await genRollupSelectv2({
            baseModelSqlv2,
            knex,
            columnOptions: (await col.getColOptions(context)) as RollupColumn,
            alias: tableAlias,
            parentColumns,
          });
          return { builder: knex.raw(qb.builder).wrap('(', ')') };
        };
        break;
      case UITypes.CreatedTime:
      case UITypes.LastModifiedTime:
      case UITypes.DateTime:
        {
          const refCol = await getRefColumnIfAlias(context, col, columns);

          if (refCol.id in aliasToColumn) {
            aliasToColumn[col.id] = aliasToColumn[refCol.id];
            break;
          }
          if (knex.clientType().startsWith('mysql')) {
            aliasToColumn[col.id] = async (): Promise<any> => {
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
            aliasToColumn[col.id] = async (): Promise<any> => {
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
            knex.clientType() === 'oracledb' &&
            (refCol.dt ?? '').toLowerCase().includes('time zone')
          ) {
            aliasToColumn[col.id] = async (): Promise<any> => {
              return {
                // Oracle TIMESTAMP WITH [LOCAL] TIME ZONE: normalize to a plain
                // UTC timestamp so date formulas (DATEADD, …) operate on the UTC
                // instant — mirroring the read path and pg/mysql. Referencing the
                // column raw makes the formula compute on the stored
                // wall-clock+offset, so the result renders an offset off in the
                // browser timezone.
                builder: knex
                  .raw(`SYS_EXTRACT_UTC(??)`, [refCol.column_name])
                  .wrap('(', ')'),
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
          aliasToColumn[col.id] = async (): Promise<any> => {
            baseUsers =
              baseUsers ??
              (await BaseUser.getUsersList(context, {
                base_id: model.base_id,
                include_internal_user: true,
              }));

            let finalStatement = '';

            // CreatedBy and LastModifiedBy with system = false has no column_name
            // need to get it from siblings
            const columnName = await getColumnName(context, col, columns);

            // create nested replace statement for each user
            if (knex.clientType() === 'pg' || knex.clientType() === 'sqlite3') {
              finalStatement = `(${DBQueryClient.get(
                knex.clientType() as ClientType,
              ).replaceDelimitedWithKeyValue({
                knex,
                needleColumn: columnName,
                stack: baseUsers.map((user) => ({
                  key: user.id,
                  value: `${user.email}`,
                })),
              })})`;
            } else {
              finalStatement = baseUsers.reduce((acc, user) => {
                const qb = knex.raw(`REPLACE(${acc}, ?, ?)`, [
                  user.id,
                  user.email,
                ]);
                return qb.toQuery();
              }, knex.raw(`??`, [columnName]).toQuery());
            }

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
      case UITypes.QrCode:
      case UITypes.Barcode: {
        const referencedColumn = await (
          await col.getColOptions<BarcodeColumn | QrCodeColumn>(context)
        ).getValueColumn(context);
        aliasToColumn[col.id] = ({ tableAlias }: TAliasToColumnParam) =>
          Promise.resolve({
            builder: knex.raw(`??.??`, [
              tableAlias ?? baseModelSqlv2.getTnPath(model.table_name),
              referencedColumn.column_name,
            ]),
          });
        break;
      }
      default:
        aliasToColumn[col.id] = ({ tableAlias }: TAliasToColumnParam) =>
          Promise.resolve({
            builder: knex.raw(`??.??`, [
              tableAlias ?? baseModelSqlv2.getTnPath(model.table_name),
              col.column_name,
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
      // MSSQL: inline string literals as `N'...'` rather than binding `?`.
      //   1. Unicode — a bound string inlines as varchar via `.toQuery()`;
      //      `N'...'` keeps it nvarchar.
      //   2. The single-query (dbQueryClient) path composes this builder into a
      //      larger query and resolves it with one final `.toQuery()`; a bound
      //      `?` placeholder gets consumed/shifted by that outer compilation.
      // Escape any `?` IN THE VALUE itself (e.g. `CONCAT(x, '?')`) to `\?` so
      // the outer `.toQuery()` treats it as a literal, not a binding
      // placeholder. Without this the stray `?` shifts every later binding —
      // e.g. a pk value lands in the `TOP (…)` clause as `TOP ('1')`, which
      // SQL Server rejects with error 1060. The final `.toQuery()` unescapes
      // `\?` back to a literal `?`. (Lookup-of-formula re-escapes after its own
      // `toQuery()`, so the net escaping stays single — see mssql.ts.)
      if (knex.clientType() === 'mssql' && typeof pt.value === 'string') {
        return {
          builder: knex.raw(
            `N'${pt.value.replace(/'/g, "''").replace(/\?/g, '\\?')}'`,
          ),
        };
      }
      if (knex.clientType() === 'mssql' && typeof pt.value === 'boolean') {
        return { builder: knex.raw(pt.value ? '1' : '0') };
      }
      return { builder: knex.raw(`?`, [pt.value]) };
    } else if (pt.type === 'Identifier') {
      const { builder } =
        (await aliasToColumn?.[pt.name]?.({
          tableAlias,
          parentColumns: params.parentColumns,
        })) || {};
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
  return { builder, parsedTree: tree };
}

/** Drop a stored formula/button column error. Throws if the meta write fails. */
async function clearFormulaColumnError(
  context: NcContext,
  column: Column,
  colOptions: { error?: string | null; type?: ButtonActionsType },
  ncMeta?: MetaService,
) {
  if (column.uidt === UITypes.Button) {
    // ButtonColumn.update picks the updatable props off `type`, so it has to
    // be passed along or `error` is dropped from the update. Without a type
    // the write would resolve having changed nothing, and the caller would
    // retry the clear on every later read.
    if (!colOptions?.type) {
      throw new Error(`Button column ${column.id} has no resolvable type`);
    }
    await ButtonColumn.update(
      context,
      column.id,
      {
        error: null,
        type: colOptions.type,
      },
      ncMeta,
    );
  } else {
    await FormulaColumn.update(context, column.id, { error: null }, ncMeta);
  }

  // both models write through to NocoCache, so only the caller's already
  // resolved copies are stale
  if (colOptions) colOptions.error = null;
  if (column.colOptions) (column.colOptions as { error?: string }).error = null;
}

/**
 * Decide what a stored formula/button error means for a read.
 *
 * A validation run persists whatever the dry-run threw, including failures
 * that say nothing about the formula (an unreachable source, a control-plane
 * hiccup). Nothing clears those afterwards — the only self-heal is a
 * *successful validated* dry-run, and reads don't validate — so the column
 * keeps failing every request long after the infrastructure recovered.
 *
 * `blocking` callers render `ERR` / skip the column as before. `revalidate`
 * asks the caller to build this one formula with `validateFormula`, so a
 * formula that really is broken re-persists its error instead of silently
 * losing the diagnostic.
 *
 * Clearing is best-effort: the trigger condition is flaky infrastructure, so
 * the meta write can fail too. It stays blocking in that case rather than
 * escaping into callers that drop the column from the SELECT entirely.
 */
export async function checkStoredFormulaError(
  context: NcContext,
  column: Column,
  colOptions: { error?: string | null; type?: ButtonActionsType },
  ncMeta?: MetaService,
): Promise<{ blocking: boolean; revalidate: boolean }> {
  if (!colOptions?.error) return { blocking: false, revalidate: false };

  if (!isTransientError(colOptions.error)) {
    return { blocking: true, revalidate: false };
  }

  try {
    await clearFormulaColumnError(context, column, colOptions, ncMeta);
  } catch (e) {
    logger.warn(
      `Failed to clear stale formula error on column ${column.id}: ${e?.message}`,
    );
    return { blocking: true, revalidate: false };
  }

  logger.warn(
    `Cleared stale formula error on column ${column.id} (${column.title})`,
  );
  return { blocking: false, revalidate: true };
}

/**
 * A broken formula is already surfaced to the user — the cell renders `ERR` —
 * and it fails identically on every read, so a stack per column per read is
 * pure noise: one bulk update alone re-reads the parent row for every record
 * it touches. Log the message without the stack, and keep full logging for
 * anything unexpected. `debug` is not an option: pino runs at `info` in every
 * deployment, so it would silence the message entirely.
 */
export function logFormulaBuildError(logger: Logger, e: any) {
  // internal control flow, not a real formula error
  if (e?.message === FORMULA_DRY_RUN_SKIPPED_MESSAGE) return;

  if (
    e instanceof NcBaseErrorv2 &&
    [NcErrorType.ERR_FORMULA, NcErrorType.ERR_CIRCULAR_REF_IN_FORMULA].includes(
      e.error,
    )
  ) {
    logger.warn(e.message);
    return;
  }

  logger.log(e);
}

export default async function formulaQueryBuilderv2({
  baseModel: baseModelSqlv2,
  tree: _tree,
  model,
  column,
  aliasToColumn = {},
  columnIdToUidt = {},
  tableAlias,
  validateFormula = false,
  parsedTree,
  baseUsers,
  parentColumns,
  columns,
}: {
  baseModel: IBaseModelSqlV2;
  tree;
  model: Model;
  column?: Column;
  aliasToColumn?: TAliasToColumn;
  columnIdToUidt?: Record<string, UITypes>;
  tableAlias?: string;
  validateFormula?: boolean;
  parsedTree?: any;
  baseUsers?: (Partial<User> & BaseUser)[];
  parentColumns?: CircularRefContext;
  columns?: Column[];
}) {
  const knex = baseModelSqlv2.dbDriver;

  const context = baseModelSqlv2.context;

  columns = columns ?? (await model.getColumns(context));

  const formulaContext = {
    count: 0,
  };
  const getAliasCount = () => {
    const result = formulaContext.count++;
    return result;
  };

  let qb;
  try {
    parentColumns = parentColumns ?? CircularRefContext.make();
    if (column) {
      parentColumns = parentColumns.cloneAndAdd({
        id: column.id,
        title: column.title,
        table: model?.title,
      });
    }
    // generate qb
    qb = await _formulaQueryBuilder({
      baseModelSqlv2,
      _tree,
      model,
      aliasToColumn,
      tableAlias,
      columnIdToUidt,
      column,
      parsedTree:
        parsedTree ??
        (await column
          ?.getColOptions<FormulaColumn | ButtonColumn>(context)
          .then((formula) => formula?.getParsedTree())),
      baseUsers,
      parentColumns,
      columns,
      getAliasCount,
    });
    let sqlLength = 0;
    try {
      sqlLength = qb?.builder?.toSQL?.().sql?.length ?? 0;
    } catch (ex) {}

    // we limit the formula length to 500k to prevent server crashing
    if (sqlLength > 500 * 1000) {
      const columnInfo = {
        title: column?.title ? `column ${column.title}` : 'new column',
        id: column?.id ? ` (${column.id})` : '',
      };
      TelemetryHandlerService.sendPriorityError(context, {
        trigger: 'formulaQueryBuilder',
        error_type: 'FORMULA_TOO_LONG_ERROR',
        message: `Generated query too long for ${columnInfo.title}${columnInfo.id}`,
      });
      NcError.get(context).formulaError(
        `The generated query for ${columnInfo.title} exceeds the maximum allowed length. Try simplifying the formula by reducing the number of referenced fields, lookup chains, or nested formula references.`,
      );
    }

    // Cap the rendered length of string-typed formula output at the database
    // level. Formula functions can produce arbitrarily large strings at
    // execution time (the query text itself stays short), which can crash the
    // Node process with ERR_STRING_TOO_LONG when the driver materializes the
    // value. Wrapping the final expression in a SUBSTR enforces an upper limit
    // per cell across all database platforms. Applied only at the outermost
    // formula (nested formula references go through `_formulaQueryBuilder`
    // directly), and only for string output to avoid altering numeric/date
    // typing. JSON-producing formulas (e.g. JSON_EXTRACT) are skipped — they
    // come back as jsonb whose representation a text cast would corrupt, and
    // they can't grow unbounded since they only read already-stored JSON.
    if (
      qb?.parsedTree?.dataType === FormulaDataTypes.STRING &&
      qb.builder &&
      !formulaOutputsRawJson(qb.parsedTree)
    ) {
      qb.builder = wrapFormulaWithMaxLength({
        knex,
        builder: qb.builder,
        maxLength: getFormulaOutputMaxLength(),
      });
    }

    if (!validateFormula) return qb;

    // Short-circuit if a previous dry-run already failed for this base model,
    // to avoid amplifying requests to an overwhelmed external source
    if (baseModelSqlv2.formulaDryRunFailed) {
      throw new Error(FORMULA_DRY_RUN_SKIPPED_MESSAGE);
    }

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
        await clearFormulaColumnError(
          { ...context, cache: false },
          column,
          formula,
        );
      }
      // clear context cache if present since metadata has changed
      context.cacheMap?.clear();
    }
  } catch (e) {
    // Check if this is a transient error (connection/timeout issue)
    const isTransient = isTransientError(e);

    // The dry-run short-circuit above re-throws a sentinel error only because an
    // earlier transient failure set `formulaDryRunFailed` (the flag's sole write
    // site is guarded by `isTransient`), and no real validation runs once it's
    // set. That sentinel is not a real formula error, so it must never be
    // persisted as the column's `error` — doing so poisons every later read with
    // ERR_FORMULA and never self-heals.
    const skipMarkingColumn =
      isTransient || !!baseModelSqlv2.formulaDryRunFailed;

    // Mark formula error if formula validation is invoked
    // or if a circular reference error occurs and a column is provided
    // BUT skip marking for transient errors (and the transient-induced
    // dry-run short-circuit, see skipMarkingColumn above)
    if (
      !skipMarkingColumn &&
      (validateFormula ||
        (column?.id &&
          e instanceof NcBaseErrorv2 &&
          e.error === NcErrorType.ERR_CIRCULAR_REF_IN_FORMULA))
    ) {
      console.error(e);

      if (column) {
        if (column?.uidt === UITypes.Button) {
          await ButtonColumn.update(context, column.id, {
            error: null,
          });
          // update cache to reflect the error in UI
          await NocoCache.update(
            context,
            `${CacheScope.COL_BUTTON}:${column.id}`,
            {
              error: e.message,
            },
          );
        } else {
          // add formula error to show in UI
          await FormulaColumn.update(context, column.id, {
            error: e.message,
          });

          // update cache to reflect the error in UI
          await NocoCache.update(
            context,
            `${CacheScope.COL_FORMULA}:${column.id}`,
            {
              error: e.message,
            },
          );
        }
      }
    } else {
      // Mark dry-run as failed so subsequent formula validations on the same
      // base model short-circuit instead of hammering an unreachable source
      if (isTransient && validateFormula) {
        baseModelSqlv2.formulaDryRunFailed = true;
      }
      throw e;
    }

    // if it's a formula error, throw it
    if (e instanceof NcBaseErrorv2) {
      throw e;
    }

    const dbError = DBErrorExtractor.get().extractDbError(e, {
      clientType: baseModelSqlv2.clientType as ClientType,
      ignoreDefault: true,
    });
    NcError.get(context).formulaError(dbError?.message ?? e.message);
  }
  return qb;
}
