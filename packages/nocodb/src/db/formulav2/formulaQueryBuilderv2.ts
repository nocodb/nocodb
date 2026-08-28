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
import { fnNodeKindOf, getFnNodeHandler } from './fn-handler';
import {
  formulaOutputsRawJson,
  getFormulaOutputMaxLength,
  wrapFormulaWithMaxLength,
} from './formula-query-builder.helpers';
import type { ClientType } from 'nocodb-sdk';

import type { ICteScope } from '~/db/cte-generator/types';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { BarcodeColumn, Model, QrCodeColumn, User } from '~/models';
import type Column from '~/models/Column';
import type RollupColumn from '~/models/RollupColumn';
import type {
  FnParsedTreeNode,
  FormulaBuildHints,
  FormulaQueryBuilderBaseParams,
  TAliasToColumn,
  TAliasToColumnParam,
} from './formula-query-builder.types';
import type {
  CteHoistOptimization,
  FnVariantOptimization,
} from '~/db/formulav2/plan';
import { isPgIeeeEnabled } from '~/db/formulav2/pg-ieee';
import {
  buildFormulaPayload,
  buildFormulaPlan,
  hoistAboveBytes,
  isCteHoistEnabled,
  makeColumnMetaResolver,
  makePlainLeafSizer,
  maxStatementBytes,
  triageFormula,
} from '~/db/formulav2/plan';
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
    payload,
    column = null,
    columns,
    getAliasCount,
  } = params;

  let { baseUsers = null } = params;

  const knex = baseModelSqlv2.dbDriver;

  const context = baseModelSqlv2.context;

  let tree = payload?.parsedTree;
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
              payload: { parsedTree: formulOption.getParsedTree() },
              baseUsers,
              parentColumns,
              getAliasCount,
              column: col,
              columns,
              cteScope: params.cteScope,
              buildHints: params.buildHints,
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

    // Every node kind is a registry entry; an unknown kind compiles to nothing,
    // which is what the old if/else chain did by falling off the end.
    const nodeHandler = getFnNodeHandler(
      fnNodeKindOf(pt),
      knex.clientType() as ClientType,
    );

    if (nodeHandler) {
      return await nodeHandler.compile({
        context,
        pt,
        fn,
        columnIdToUidt,
        knex,
        prevBinaryOp,
        aliasToColumn,
        model,
        tableAlias,
        parentColumns: params.parentColumns,
        buildHints: params.buildHints,
      });
    }
  };
  const builder = (await fn(tree)).builder;
  // the payload back out, so a caller that had none still learns the tree that
  // was parsed, and one that passed a plan gets it handed straight back
  return { builder, payload: { ...payload, parsedTree: tree } };
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
  cteScope,
  disableCteHoist,
  buildHints,
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
  cteScope?: ICteScope;
  /**
   * Refuse to hoist even above the threshold. Set by callers that stringify
   * the whole statement before `execAndParse`, where `applyCte` is skipped and
   * the registered blocks would dangle.
   */
  disableCteHoist?: boolean;
  columns?: Column[];
  /** pins on how the expression is generated — see FormulaBuildHints */
  buildHints?: FormulaBuildHints;
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
    // callers hand in a bare tree; the payload is this module's transport
    const rootTree =
      parsedTree ??
      (await column
        ?.getColOptions<FormulaColumn | ButtonColumn>(context)
        .then((formula) => formula?.getParsedTree()));

    const build = (payload, scope?: ICteScope) =>
      _formulaQueryBuilder({
        baseModelSqlv2,
        _tree,
        model,
        aliasToColumn: payload === undefined ? aliasToColumn : {},
        tableAlias,
        columnIdToUidt: payload === undefined ? columnIdToUidt : {},
        column,
        payload: payload ?? { parsedTree: rootTree },
        baseUsers,
        parentColumns,
        columns,
        getAliasCount,
        cteScope: scope ?? cteScope,
        buildHints,
      });

    let hoistScope: ICteScope | undefined;
    let hoistPlan: Awaited<ReturnType<typeof buildFormulaPlan>> | null = null;
    /** the plan already had its say — do not ask it the same question twice */
    let planned = false;

    // Where the gate could act at all. Checked before triage rather than after,
    // because triage is the thing that costs metadata.
    const canGate =
      isCteHoistEnabled() &&
      !cteScope &&
      !disableCteHoist &&
      knex.clientType() === 'pg' &&
      typeof knex.cteGenerator === 'function';

    /**
     * Plan the tree and, if the plan asks for it, build the optimized form.
     * Returns the build, or null when the plan had nothing to apply — the
     * caller then falls back to (or keeps) the inline build.
     */
    const buildOptimized = async (tree: unknown, measuredBytes?: number) => {
      hoistPlan = await buildFormulaPlan({
        tree,
        resolve: makeColumnMetaResolver(context),
        ieee: isPgIeeeEnabled(knex),
        fnVariants: buildHints?.fnVariants,
      }).catch(() => null);

      // The plan's decisions, verbatim. Everything below follows from this
      // line, so a build's strategy can be read out of the log rather than
      // inferred from the SQL it produced. `warn` when the plan wanted
      // something it could not have.
      if (hoistPlan?.optimizations.length) {
        const summary = hoistPlan.optimizations
          .map((opt) => `[${opt.kind}/${opt.status}] ${opt.reason}`)
          .join(' | ');
        const message = `Formula ${column?.id ?? 'preview'} plan (${
          measuredBytes === undefined
            ? 'pre-build'
            : `${measuredBytes}B measured`
        }): ${summary}`;
        if (
          hoistPlan.optimizations.some((opt) => opt.status === 'unavailable')
        ) {
          logger.warn(message);
        } else {
          logger.log(message);
        }
      }

      // No `apply` entry means the plan found nothing worth rebuilding for — a
      // ratio near 1, where hoisting would rewrite the SQL for no saving.
      const hoistDirective = hoistPlan?.optimizations.find(
        (opt): opt is CteHoistOptimization =>
          opt.kind === 'cte-hoist' && opt.status === 'apply',
      );
      const wantsRelowering = (hoistPlan?.optimizations ?? []).some(
        (opt) =>
          opt.kind === 'fn-variant' && opt.status === 'apply' && !!opt.variant,
      );
      if (!hoistDirective && !wantsRelowering) return null;

      // The plan folded onto the tree it describes. Each `apply` decision now
      // sits on the node it applies to, so the build carries its own
      // instructions and there is no second argument that has to agree with
      // the tree. Only hoisting needs a scope; a build that just re-lowers
      // some sites registers no blocks.
      const payload = wantsRelowering
        ? buildFormulaPayload({ tree, plan: hoistPlan })
        : { parsedTree: tree };
      const scope = hoistDirective
        ? knex.cteGenerator(context).openScope()
        : undefined;
      try {
        const built = await build(payload, scope);
        return { built, scope };
      } catch (ex) {
        // all-or-nothing: a partially registered set would leave the next
        // query referencing aliases with no WITH clause
        scope?.rollback();
        logger.log(ex);
        return null;
      }
    };

    // ---- strategy selection, BEFORE the build ---------------------------
    // Sizing the tree first is what lets the big cases skip building the
    // inline form only to throw it away. `triageFormula` walks the tree and
    // resolves only the references that are not plain columns of this model,
    // so an ordinary formula reaches this with no metadata reads at all.
    let estimatedBytes: number | undefined;
    if (canGate) {
      const triage = await triageFormula(rootTree, {
        clientType: knex.clientType() as ClientType,
        pgIeee: isPgIeeeEnabled(knex),
        fnVariants: buildHints?.fnVariants,
        resolve: makeColumnMetaResolver(context),
        plainBytes: makePlainLeafSizer(columns, tableAlias ?? model.table_name),
      });
      // Only act on a SIZED estimate. Unsized it is a floor, and a floor that
      // happens to clear the threshold says nothing about the real size.
      if (triage.estimateIsSized) estimatedBytes = triage.estimatedBytes;

      if (
        triage.estimateIsSized &&
        triage.worthPlanning &&
        triage.estimatedBytes > hoistAboveBytes()
      ) {
        logger.log(
          `Formula ${column?.id ?? 'preview'} triage: estimated ${
            triage.estimatedBytes
          }B, over the ${hoistAboveBytes()}B hoist threshold — ${
            triage.reason
          }`,
        );
        planned = true;
        const attempt = await buildOptimized(rootTree);
        if (attempt) {
          qb = attempt.built;
          hoistScope = attempt.scope;
        }
      }
    }

    // The ordinary path, and the fallback when the plan declined or threw.
    if (!qb) qb = await build(undefined);

    let sqlLength = 0;
    try {
      sqlLength = qb?.builder?.toSQL?.().sql?.length ?? 0;
    } catch (ex) {}

    // The one place estimate and measurement can be compared on a real schema.
    // Logged only for builds big enough to matter, so an ordinary read stays
    // quiet, and only when the estimate was sized — an unsized floor says
    // nothing about accuracy. `warn` on an UNDER-estimate: that is the
    // direction that would let an oversized query past the pre-build gate, and
    // it is the signal that the leaf constants need recalibrating.
    // `!planned` keeps it like-for-like: once the pre-build hoist fires, what
    // was measured is the hoisted form, not the inline one the estimate models.
    if (
      !planned &&
      estimatedBytes !== undefined &&
      sqlLength > hoistAboveBytes() / 4
    ) {
      const ratio = estimatedBytes / Math.max(1, sqlLength);
      const line =
        `Formula ${column?.id ?? 'preview'} size: estimated ` +
        `${estimatedBytes}B vs measured ${sqlLength}B (${ratio.toFixed(2)}x)`;
      if (ratio < 1) logger.warn(line);
      else logger.log(line);
    }

    // Safety net for an estimate that came in low. The estimate is measured at
    // 1.02-1.29x of actual and biased high, but it is still an estimate, and
    // under is the direction that would let an oversized query through — so
    // the MEASURED length keeps its own say. Here there is an inline build in
    // hand, so a rebuild has to prove it shrank something.
    if (!planned && canGate && sqlLength > hoistAboveBytes()) {
      const attempt = await buildOptimized(qb?.payload?.parsedTree, sqlLength);
      const rebuiltLength = attempt?.built?.builder?.toSQL?.().sql?.length ?? 0;
      if (attempt && rebuiltLength > 0 && rebuiltLength < sqlLength) {
        qb = attempt.built;
        sqlLength = rebuiltLength;
        hoistScope = attempt.scope;
      } else {
        // no saving materialised — discard every block this attempt added
        attempt?.scope?.rollback();
      }
    }

    // Hoisting shrinks the expression by moving bulk into block bodies that
    // `applyCte` splices in later, so the expression alone stops reflecting
    // what the database is asked to parse. Measure the blocks this build
    // registered and hold the total to its own ceiling.
    let statementLength = sqlLength;
    if (hoistScope) {
      for (const block of hoistScope.blocks) {
        try {
          const probe = knex.queryBuilder();
          block.applyCte(probe, { context, knex });
          statementLength += probe.toSQL().sql.length;
        } catch {
          // an unmeasurable block must not fail the query; the expression cap
          // below still applies
        }
      }
    }

    // we limit the formula length to 500k to prevent server crashing
    if (sqlLength > 500 * 1000 || statementLength > maxStatementBytes()) {
      // this throws, so the blocks registered above would otherwise stay on the
      // shared generator and dangle into the next query
      hoistScope?.rollback();
      const columnInfo = {
        title: column?.title ? `column ${column.title}` : 'new column',
        id: column?.id ? ` (${column.id})` : '',
      };
      TelemetryHandlerService.sendPriorityError(context, {
        trigger: 'formulaQueryBuilder',
        error_type: 'FORMULA_TOO_LONG_ERROR',
        message: `Generated query too long for ${columnInfo.title}${columnInfo.id}`,
      });
      // Name the heaviest references when the plan is available — "reduce the
      // number of referenced fields" is far more actionable with the actual
      // offenders and a count attached.
      const heaviest = hoistPlan
        ? [...hoistPlan.refs.values()]
            .filter((r) => r.leafPaths > 1)
            .sort(
              (a, b) => b.leafPaths * b.siteCount - a.leafPaths * a.siteCount,
            )
            .slice(0, 3)
            .map((r) => r.columnId)
        : [];
      // "reduce the referenced fields" is the wrong advice when a duplicating
      // operator is the multiplier — the field count is fine and nesting is
      // what grew. Name the operators instead. Which ones, and whether to say
      // anything at all, comes from the plan's decision list; only the
      // user-facing wording lives here (`reason` is written for logs).
      // Gated on dominance, not on the mere presence of a duplicating site: one
      // incidental `/` in a formula that blew the cap on field fan-out would
      // otherwise be blamed for a 1x multiplier.
      const wantedVariants = hoistPlan?.duplicationDominant
        ? hoistPlan.optimizations.filter(
            (opt): opt is FnVariantOptimization =>
              opt.kind === 'fn-variant' && opt.status === 'unavailable',
          )
        : [];
      const duplication = wantedVariants.length
        ? ` Operands repeated by ${[
            // a key can span several entries once its sites split by variant
            ...new Set(wantedVariants.map((opt) => opt.key)),
          ]
            .slice(0, 3)
            .join(', ')} multiply it ${hoistPlan!.duplicationFactor.toFixed(
            0,
          )}x` +
          (hoistPlan!.maxDuplicationChain > 1
            ? `, and nesting them (${
                hoistPlan!.maxDuplicationChain
              } deep here) multiplies again at every level.`
            : '.')
        : '';
      const detail =
        (hoistPlan
          ? ` This formula reaches ${hoistPlan.inlineLeafPaths} referenced fields` +
            (heaviest.length
              ? `; the heaviest are ${heaviest.join(', ')}.`
              : '.')
          : '') +
        duplication +
        (statementLength > maxStatementBytes()
          ? ` The full statement is ${Math.round(statementLength / 1000)}kb.`
          : '');
      NcError.get(context).formulaError(
        `The generated query for ${columnInfo.title} exceeds the maximum allowed length. Try simplifying the formula by reducing the number of referenced fields, lookup chains, or nested formula references.${detail}`,
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
      qb?.payload?.parsedTree?.dataType === FormulaDataTypes.STRING &&
      qb.builder &&
      !formulaOutputsRawJson(qb.payload.parsedTree)
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
    try {
      await baseModelSqlv2.execAndParse(
        knex(baseModelSqlv2.getTnPath(model, tableAlias))
          .select(knex.raw(`?? as ??`, [qb.builder, '__dry_run_alias']))
          .as('dry-run-only'),
        null,
        { raw: true },
      );
    } finally {
      // execAndParse runs applyCte, which APPLIES the registered blocks to the
      // dry-run query and then clears them — so the real query that embeds
      // this same expression would reference aliases with no WITH clause.
      // Put them back. `validateFormula` is not a create-time-only path: the
      // ordinary read retries with it whenever a formula query fails.
      hoistScope?.restore();
    }

    // if column is provided, i.e. formula has been created
    if (column) {
      const formula = await column.getColOptions<FormulaColumn | ButtonColumn>(
        context,
      );
      // clean the previous formula error if the formula works this time
      if (formula.error) {
        if (formula.constructor.name === 'ButtonColumn') {
          await ButtonColumn.update({ ...context, cache: false }, column.id, {
            error: null,
          });
        } else {
          await FormulaColumn.update({ ...context, cache: false }, column.id, {
            error: null,
          });
        }
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
