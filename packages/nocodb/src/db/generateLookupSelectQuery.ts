import {
  isBtLikeV2Junction,
  isMMOrMMLike,
  isSupportedDisplayValueColumn,
  NC_ERROR_SENTINEL,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { ClientType } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { QueryWithCte } from '~/helpers/dbHelpers';
import type { NcContext } from '~/interface/config';
import type {
  BarcodeColumn,
  Column,
  FormulaColumn,
  LinksColumn,
  LinkToAnotherRecordColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import type LookupColumn from '../models/LookupColumn';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import {
  applyLookupSortLimitToQb,
  loadLookupSortAndLimit,
} from '~/db/lookupSortLimit';
import { NcError } from '~/helpers/catchError';
import { getAliasedSoftDeleteFilter, getAs } from '~/helpers/dbHelpers';
import { Model, View } from '~/models';
import { getAliasGenerator } from '~/utils';
import { DBQueryClient } from '~/dbQueryClient';

const LOOKUP_VAL_SEPARATOR = '___';

export async function getDisplayValueOfRefTable(
  context: NcContext,
  relationCol: Column<LinkToAnotherRecordColumn | LinksColumn>,
) {
  // Use the column's own base_id for getColOptions since the relation metadata
  // is stored in the column's base, not the related table's base (cross-base links)
  const colOpt = await relationCol.getColOptions<
    LinkToAnotherRecordColumn | LinksColumn
  >({ ...context, base_id: relationCol.base_id });
  const model = await colOpt.getRelatedTable(context);
  const modelContext = { ...context, base_id: model.base_id };
  const cols = await model.getColumns(modelContext);

  // Honor per-LTAR-column override. Defensive fallback to PV if the override
  // points to a stale/unsupported column (e.g. deleted mid-session before
  // Column.delete2 cleanup commits).
  const overrideId = (colOpt as LinkToAnotherRecordColumn)
    .fk_display_value_column_id;
  if (overrideId) {
    const override = cols.find((c) => c.id === overrideId);
    if (override && isSupportedDisplayValueColumn(override)) return override;
  }

  return cols.find((col) => col.pv) || cols[0];
}

/**
 * Like getDisplayValueOfRefTable but supports filtering by the related record's
 * primary key when ltarSubField is 'id' (case-insensitive).
 *
 * Only 'id' is supported as a sub-field — generic title-based column lookup is
 * excluded to prevent accessing columns that may be hidden in the related
 * table's view.
 *
 * The PK column is checked against the LTAR's target view (fk_target_view_id,
 * falling back to the first collaborative view). If the PK column is hidden in
 * that view, this falls back to the display value so the filter still works but
 * does not expose data the view owner intended to restrict.
 *
 * Falls back to the display value when ltarSubField is absent or not 'id'.
 */
export async function getRefTableColumnForFilter(
  context: NcContext,
  relationCol: Column<LinkToAnotherRecordColumn | LinksColumn>,
  ltarSubField?: string,
) {
  if (!ltarSubField) {
    return getDisplayValueOfRefTable(context, relationCol);
  }

  // Only 'id' (case-insensitive) is permitted.
  if (ltarSubField.toLowerCase() !== 'id') {
    return getDisplayValueOfRefTable(context, relationCol);
  }

  const colOpt = await relationCol.getColOptions<
    LinkToAnotherRecordColumn | LinksColumn
  >({ ...context, base_id: relationCol.base_id });
  const model = await colOpt.getRelatedTable(context);
  const modelContext = { ...context, base_id: model.base_id };
  const cols = await model.getColumns(modelContext);

  const pkCol = cols.find((col) => col.pk);
  if (!pkCol) return null;

  // Resolve the target view: use the LTAR-configured view if set, otherwise
  // fall back to the first collaborative (grid) view of the related table.
  const targetViewId = (colOpt as LinkToAnotherRecordColumn).fk_target_view_id;
  const targetView = targetViewId
    ? await View.get(modelContext, targetViewId)
    : await View.getFirstCollaborativeView(modelContext, model.id);

  if (targetView) {
    const viewCols = await View.getColumns(modelContext, targetView.id);
    const pkViewCol = viewCols.find((vc) => vc.fk_column_id === pkCol.id);
    // If PK is explicitly hidden in the target view, fall back to display value.
    if (pkViewCol && !pkViewCol.show) {
      return getDisplayValueOfRefTable(context, relationCol);
    }
  }

  return pkCol;
}

// this function will generate the query for lookup column
// or for  LTAR column and return the query builder
// query result will be aggregated json array string in case of Myssql and Postgres
// and string with separator in case of sqlite and mysql
// this function is used for sorting and grouping of lookup/LTAR column at the moment
export default async function generateLookupSelectQuery({
  column,
  baseModelSqlv2,
  alias,
  model: _model,
  getAlias = getAliasGenerator('__lk_slt_'),
  isAggregation = false,
}: {
  column: Column;
  baseModelSqlv2: IBaseModelSqlV2;
  alias: string;
  model: Model;
  getAlias?: ReturnType<typeof getAliasGenerator>;
  isAggregation?: boolean;
}): Promise<QueryWithCte> {
  const knex = baseModelSqlv2.dbDriver;

  const dbQueryClient = DBQueryClient.get(knex.clientType() as ClientType);

  const context = baseModelSqlv2.context;

  // Captured before the inner `context`/`baseModelSqlv2` shadows below — the
  // lookup's sort+limit config lives under the root base, and the feature is
  // PG-only (mirrors the display path).
  const rootContext = context;
  const rootIsPg = baseModelSqlv2.isPg;

  const rootAlias = alias;

  {
    let selectQb: Knex.QueryBuilder;
    const alias = getAlias();
    let lookupColOpt: LookupColumn;
    let isBtLookup = true;

    const applyCte = (_qb: Knex.QueryBuilder) => {};

    if (column.uidt === UITypes.Lookup) {
      lookupColOpt = await column.getColOptions<LookupColumn>(context);
      if (lookupColOpt?.error) {
        return {
          builder: NC_ERROR_SENTINEL,
          applyCte: () => {},
        };
      }
    } else if (
      column.uidt !== UITypes.LinkToAnotherRecord &&
      column.uidt !== UITypes.Links
    ) {
      NcError.get(context).badRequest('Invalid field type');
    }

    await column.getColOptions<LookupColumn>(context);
    let refContext: NcContext;
    {
      const relationCol = lookupColOpt
        ? await lookupColOpt.getRelationColumn(context)
        : column;

      if (!relationCol) {
        return {
          builder: NC_ERROR_SENTINEL,
          applyCte: () => {},
        };
      }

      const relation =
        await relationCol.getColOptions<LinkToAnotherRecordColumn>(context);

      const isMMLike = isMMOrMMLike(relationCol);

      const {
        parentContext,
        childContext,
        refContext: _refContext,
        mmContext,
      } = await relation.getParentChildContext(context, relationCol);
      refContext = _refContext;

      let relationType = relation.type;

      if (relationType === RelationTypes.ONE_TO_ONE) {
        relationType = relationCol.meta?.bt
          ? RelationTypes.BELONGS_TO
          : RelationTypes.HAS_MANY;
      }

      if (relationType === RelationTypes.BELONGS_TO && !isMMLike) {
        const childColumn = await relation.getChildColumn(context);
        const parentColumn = await relation.getParentColumn(context);
        const childModel = await childColumn.getModel(childContext);
        await childModel.getColumns(childContext);
        const parentModel = await parentColumn.getModel(parentContext);
        await parentModel.getColumns(parentContext);

        const childBaseModel = await Model.getBaseModelSQL(childContext, {
          model: childModel,
          dbDriver: knex,
        });

        const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
          model: parentModel,
          dbDriver: knex,
        });

        selectQb = knex(
          dbQueryClient.tableAlias(
            knex,
            parentBaseModel.getTnPath(parentModel.table_name),
            alias,
          ),
        ).where(
          `${alias}.${parentColumn.column_name}`,
          knex.raw(`??`, [
            `${rootAlias || childBaseModel.getTnPath(childModel.table_name)}.${
              childColumn.column_name
            }`,
          ]),
        );

        // Exclude soft-deleted parent records from BT lookup
        const btSoftDeleteFilter = await getAliasedSoftDeleteFilter(
          parentBaseModel,
          alias,
        );
        if (btSoftDeleteFilter) {
          selectQb.where(btSoftDeleteFilter);
        }
      } else if (relationType === RelationTypes.HAS_MANY && !isMMLike) {
        isBtLookup = false;
        const childColumn = await relation.getChildColumn(context);
        const parentColumn = await relation.getParentColumn(context);
        const childModel = await childColumn.getModel(childContext);
        await childModel.getColumns(childContext);
        const parentModel = await parentColumn.getModel(parentContext);
        await parentModel.getColumns(parentContext);

        const childBaseModel = await Model.getBaseModelSQL(childContext, {
          model: childModel,
          dbDriver: knex,
        });

        const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
          model: parentModel,
          dbDriver: knex,
        });

        selectQb = knex(
          dbQueryClient.tableAlias(
            knex,
            childBaseModel.getTnPath(childModel.table_name),
            alias,
          ),
        ).where(
          `${alias}.${childColumn.column_name}`,
          knex.raw(`??`, [
            `${
              rootAlias || parentBaseModel.getTnPath(parentModel.table_name)
            }.${parentColumn.column_name}`,
          ]),
        );

        // Exclude soft-deleted child records from HM lookup
        const hmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
          childBaseModel,
          alias,
        );
        if (hmSoftDeleteFilter) {
          selectQb.where(hmSoftDeleteFilter);
        }
      } else if (relationType === RelationTypes.MANY_TO_MANY || isMMLike) {
        const isSingleTargetV2 = isBtLikeV2Junction(relationCol);
        if (!isSingleTargetV2) {
          isBtLookup = false;
        }
        const childColumn = await relation.getChildColumn(context);
        const parentColumn = await relation.getParentColumn(context);
        const childModel = await childColumn.getModel(childContext);
        await childModel.getColumns(childContext);
        const parentModel = await parentColumn.getModel(parentContext);
        await parentModel.getColumns(parentContext);

        const childBaseModel = await Model.getBaseModelSQL(childContext, {
          model: childModel,
          dbDriver: knex,
        });

        const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
          model: parentModel,
          dbDriver: knex,
        });

        selectQb = knex(
          dbQueryClient.tableAlias(
            knex,
            parentBaseModel.getTnPath(parentModel.table_name),
            alias,
          ),
        );

        const mmTableAlias = getAlias();

        const mmModel = await relation.getMMModel(context);
        const mmChildCol = await relation.getMMChildColumn(context);
        const mmParentCol = await relation.getMMParentColumn(context);

        const associatedBaseModel = await Model.getBaseModelSQL(mmContext, {
          model: mmModel,
          dbDriver: knex,
        });

        selectQb
          .innerJoin(
            associatedBaseModel.getTnPath(mmModel.table_name, mmTableAlias),
            knex.ref(`${mmTableAlias}.${mmParentCol.column_name}`) as any,
            '=',
            knex.ref(`${alias}.${parentColumn.column_name}`) as any,
          )
          .where(
            knex.ref(`${mmTableAlias}.${mmChildCol.column_name}`),
            '=',
            knex.ref(
              `${
                rootAlias || childBaseModel.getTnPath(childModel.table_name)
              }.${childColumn.column_name}`,
            ),
          );

        // Exclude soft-deleted referenced records from MM lookup
        const mmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
          parentBaseModel,
          alias,
        );
        if (mmSoftDeleteFilter) {
          selectQb.where(mmSoftDeleteFilter);
        }

        if (isSingleTargetV2) {
          selectQb.limit(1);
        }
      }
    }
    let lookupColumn = lookupColOpt
      ? await lookupColOpt.getLookupColumn(refContext)
      : await getDisplayValueOfRefTable(refContext, column);

    if (!lookupColumn) {
      return {
        builder: NC_ERROR_SENTINEL,
        applyCte: () => {},
      };
    }

    // if lookup column is qr code or barcode extract the referencing column
    if ([UITypes.QrCode, UITypes.Barcode].includes(lookupColumn.uidt)) {
      // For cross-base lookups, lookupColumn might belong to a different base than context
      const lookupColContext = lookupColumn.base_id
        ? { ...context, base_id: lookupColumn.base_id }
        : context;
      const colOpt = await lookupColumn.getColOptions<
        BarcodeColumn | QrCodeColumn
      >(lookupColContext);
      lookupColumn = colOpt ? await colOpt.getValueColumn(refContext) : null;
      if (!lookupColumn) {
        return {
          builder: NC_ERROR_SENTINEL,
          applyCte: () => {},
        };
      }
    }
    {
      let prevAlias = alias;
      let context = refContext;
      // Nested lookups are flattened via JOINs here (not per-level
      // sub-aggregation like the display path), so per-level sort+limit can't be
      // applied consistently — restrict the injection below to single-level.
      let nested = false;
      while (
        lookupColumn.uidt === UITypes.Lookup ||
        lookupColumn.uidt === UITypes.LinkToAnotherRecord
      ) {
        nested = true;
        const nestedAlias = getAlias();

        let relationCol: Column<LinkToAnotherRecordColumn | LinksColumn>;
        let nestedLookupColOpt: LookupColumn;

        if (lookupColumn.uidt === UITypes.Lookup) {
          nestedLookupColOpt = await lookupColumn.getColOptions<LookupColumn>(
            context,
          );
          if (nestedLookupColOpt?.error) {
            return {
              builder: NC_ERROR_SENTINEL,
              applyCte: () => {},
            };
          }
          relationCol = await nestedLookupColOpt.getRelationColumn(context);
        } else {
          relationCol = lookupColumn;
        }

        if (!relationCol) {
          return {
            builder: NC_ERROR_SENTINEL,
            applyCte: () => {},
          };
        }

        const relation =
          await relationCol.getColOptions<LinkToAnotherRecordColumn>(context);

        let relationType = isMMOrMMLike(relationCol)
          ? RelationTypes.MANY_TO_MANY
          : relation.type;

        if (relationType === RelationTypes.ONE_TO_ONE) {
          relationType = relationCol.meta?.bt
            ? RelationTypes.BELONGS_TO
            : RelationTypes.HAS_MANY;
        }
        const {
          parentContext,
          childContext,
          refContext: nestedRefContext,
          mmContext,
        } = await relation.getParentChildContext(context, relationCol);

        // if any of the relation in nested lookupColOpt is
        // not belongs to then throw error as we don't support
        if (relationType === RelationTypes.BELONGS_TO) {
          const childColumn = await relation.getChildColumn(context);
          const parentColumn = await relation.getParentColumn(context);
          const childModel = await childColumn.getModel(childContext);
          await childModel.getColumns(childContext);
          const parentModel = await parentColumn.getModel(parentContext);
          await parentModel.getColumns(parentContext);
          const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
            model: parentModel,
            dbDriver: knex,
          });

          selectQb.join(
            dbQueryClient.tableAlias(
              knex,
              parentBaseModel.getTnPath(parentModel.table_name),
              nestedAlias,
            ),
            `${nestedAlias}.${parentColumn.column_name}`,
            `${prevAlias}.${childColumn.column_name}`,
          );

          // Exclude soft-deleted parent records from nested BT lookup
          const nestedBtSoftDeleteFilter = await getAliasedSoftDeleteFilter(
            parentBaseModel,
            nestedAlias,
          );
          if (nestedBtSoftDeleteFilter) {
            selectQb.where(nestedBtSoftDeleteFilter);
          }
        } else if (relationType === RelationTypes.HAS_MANY) {
          isBtLookup = false;
          const childColumn = await relation.getChildColumn(context);
          const parentColumn = await relation.getParentColumn(context);
          const childModel = await childColumn.getModel(childContext);
          await childModel.getColumns(childContext);
          const parentModel = await parentColumn.getModel(parentContext);
          await parentModel.getColumns(parentContext);
          const childBaseModel = await Model.getBaseModelSQL(childContext, {
            model: childModel,
            dbDriver: knex,
          });

          selectQb.join(
            dbQueryClient.tableAlias(
              knex,
              childBaseModel.getTnPath(childModel.table_name),
              nestedAlias,
            ),
            `${nestedAlias}.${childColumn.column_name}`,
            `${prevAlias}.${parentColumn.column_name}`,
          );

          // Exclude soft-deleted child records from nested HM lookup
          const nestedHmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
            childBaseModel,
            nestedAlias,
          );
          if (nestedHmSoftDeleteFilter) {
            selectQb.where(nestedHmSoftDeleteFilter);
          }
        } else if (relationType === RelationTypes.MANY_TO_MANY) {
          const nestedIsSingleTargetV2 = isBtLikeV2Junction(relationCol);
          if (!nestedIsSingleTargetV2) {
            isBtLookup = false;
          }
          const childColumn = await relation.getChildColumn(context);
          const parentColumn = await relation.getParentColumn(context);
          const childModel = await childColumn.getModel(childContext);
          await childModel.getColumns(childContext);
          const parentModel = await parentColumn.getModel(parentContext);
          await parentModel.getColumns(parentContext);

          const childBaseModel = await Model.getBaseModelSQL(childContext, {
            model: childModel,
            dbDriver: knex,
          });

          const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
            model: parentModel,
            dbDriver: knex,
          });

          const mmTableAlias = getAlias();

          const mmModel = await relation.getMMModel(context);
          const mmChildCol = await relation.getMMChildColumn(context);
          const mmParentCol = await relation.getMMParentColumn(context);

          const associatedBaseModel = await Model.getBaseModelSQL(mmContext, {
            model: mmModel,
            dbDriver: knex,
          });

          selectQb
            .innerJoin(
              associatedBaseModel.getTnPath(mmModel.table_name, mmTableAlias),
              knex.ref(`${mmTableAlias}.${mmChildCol.column_name}`) as any,
              '=',
              knex.ref(`${prevAlias}.${childColumn.column_name}`) as any,
            )
            .innerJoin(
              dbQueryClient.tableAlias(
                knex,
                parentBaseModel.getTnPath(parentModel.table_name),
                nestedAlias,
              ),
              knex.ref(`${mmTableAlias}.${mmParentCol.column_name}`) as any,
              '=',
              knex.ref(`${nestedAlias}.${parentColumn.column_name}`) as any,
            )
            .where(
              knex.ref(`${mmTableAlias}.${mmChildCol.column_name}`),
              '=',
              knex.ref(
                `${alias || childBaseModel.getTnPath(childModel.table_name)}.${
                  childColumn.column_name
                }`,
              ),
            );

          // Exclude soft-deleted referenced records from nested MM lookup
          const nestedMmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
            parentBaseModel,
            nestedAlias,
          );
          if (nestedMmSoftDeleteFilter) {
            selectQb.where(nestedMmSoftDeleteFilter);
          }

          if (nestedIsSingleTargetV2) {
            selectQb.limit(1);
          }
        }

        if (lookupColumn.uidt === UITypes.Lookup)
          lookupColumn = await nestedLookupColOpt.getLookupColumn(
            nestedRefContext,
          );
        else
          lookupColumn = await getDisplayValueOfRefTable(
            nestedRefContext,
            relationCol,
          );

        if (!lookupColumn) {
          return {
            builder: NC_ERROR_SENTINEL,
            applyCte: () => {},
          };
        }

        prevAlias = nestedAlias;
        context = nestedRefContext;
      }

      {
        // get basemodel and model of lookup column
        const model = await lookupColumn.getModel(context);
        const baseModelSqlv2 = await Model.getBaseModelSQL(context, {
          model,
          dbDriver: knex,
        });

        switch (lookupColumn.uidt) {
          case UITypes.Links:
          case UITypes.Rollup:
            {
              const builder = (
                await genRollupSelectv2({
                  baseModelSqlv2,
                  knex,
                  columnOptions: (await lookupColumn.getColOptions(
                    context,
                  )) as RollupColumn,
                  alias: prevAlias,
                })
              ).builder;
              selectQb.select({
                [lookupColumn.id]: knex.raw(builder).wrap('(', ')'),
              });
            }
            break;
          case UITypes.Formula:
            {
              const builder = (
                await formulaQueryBuilderv2({
                  baseModel: baseModelSqlv2,
                  tree: (
                    await lookupColumn.getColOptions<FormulaColumn>(context)
                  ).formula,
                  model,
                  column: lookupColumn,
                  aliasToColumn: await model.getAliasColMapping(context),
                  tableAlias: prevAlias,
                })
              ).builder;

              selectQb.select(
                knex.raw(`?? as ??`, [builder, getAs(lookupColumn)]),
              );
            }
            break;
          case UITypes.DateTime:
          case UITypes.LastModifiedTime:
          case UITypes.CreatedTime:
            {
              await baseModelSqlv2.selectObject({
                qb: selectQb,
                columns: [lookupColumn],
                alias: prevAlias,
              });
            }
            break;
          case UITypes.Attachment:
            if (!isAggregation) {
              NcError.get(context).badRequest(
                'Group by using attachment column is not supported',
              );
              break;
            }
          // eslint-disable-next-line no-fallthrough
          default:
            {
              selectQb.select(
                `${prevAlias}.${lookupColumn.column_name} as ${lookupColumn.id}`,
              );
            }

            break;
        }

        // Per-lookup Sort + Limit (PG, single-level): order/slice the relation
        // sub-query before it is aggregated so filter / view-sort / group-by see
        // the same limited+sorted set as the displayed cell. Only fires for a
        // configured Lookup column; a no-op otherwise. Nested lookups are
        // flattened via JOINs here, so they're intentionally left out for now.
        if (!nested && column.uidt === UITypes.Lookup && rootIsPg) {
          const cfg = await loadLookupSortAndLimit(rootContext, column);
          if (cfg.hasConfig) {
            await applyLookupSortLimitToQb({
              qb: selectQb,
              alias: prevAlias,
              refBaseModel: baseModelSqlv2,
              sorts: cfg.sorts,
              limitVal: cfg.limitVal,
              takeLast: cfg.takeLast,
            });
          }
        }
      }
      // if all relation are belongs to then we don't need to do the aggregation
      if (isBtLookup) {
        return {
          builder: selectQb,
          applyCte,
        };
      }

      const subQueryAlias = getAlias();

      if (baseModelSqlv2.isPg) {
        // alternate approach with array_agg
        return {
          builder: knex
            .select(knex.raw('json_agg(??)::text', [lookupColumn.id]))
            .from(selectQb.as(subQueryAlias)),
          applyCte,
        };
        /*
        // alternate approach with array_agg
        return {
          builder: knex
            .select(knex.raw('array_agg(??)', [lookupColumn.id]))
            .from(selectQb),
        };*/
        // alternate approach with string aggregation
        // return {
        //   builder: knex
        //     .select(
        //       knex.raw('STRING_AGG(??::text, ?)', [
        //         lookupColumn.id,
        //         LOOKUP_VAL_SEPARATOR,
        //       ]),
        //     )
        //     .from(selectQb.as(subQueryAlias)),
        // };
      } else if (baseModelSqlv2.isMySQL) {
        return {
          builder: knex
            .select(
              knex.raw('cast(JSON_ARRAYAGG(??) as NCHAR)', [lookupColumn.id]),
            )
            .from(selectQb.as(subQueryAlias)),
          applyCte,
        };

        // return {
        //   builder: knex
        //     .select(
        //       knex.raw('GROUP_CONCAT(?? ORDER BY ?? ASC SEPARATOR ?)', [
        //         lookupColumn.id,
        //         lookupColumn.id,
        //         LOOKUP_VAL_SEPARATOR,
        //       ]),
        //     )
        //     .from(selectQb.as(subQueryAlias)),
        // };
      } else if (baseModelSqlv2.isSqlite) {
        // ref: https://stackoverflow.com/questions/13382856/sqlite3-join-group-concat-using-distinct-with-custom-separator
        // selectQb.orderBy(`${lookupColumn.id}`, 'asc');
        return {
          builder: knex
            .select(
              knex.raw(`group_concat(??, ?)`, [
                lookupColumn.id,
                LOOKUP_VAL_SEPARATOR,
              ]),
            )
            .from(selectQb.as(subQueryAlias)),
          applyCte,
        };
      } else if (baseModelSqlv2.isMssql) {
        return {
          builder: knex
            .select(
              // Emit a JSON array string (`["English","English"]`) to match
              // the shape pg's `json_agg(col)::text` / mysql's
              // `JSON_ARRAYAGG(col)` return. The legacy `STRING_AGG(.., '___')`
              // form was a delimited string, awkward to JSON.parse on the
              // consumer side.
              //
              // Steps:
              //   • RTRIM    — strip trailing-space padding T-SQL preserves on
              //                fixed-length char/nchar columns (no-op on
              //                varchar/nvarchar/numeric).
              //   • CAST     — every value is rendered as a string for JSON
              //                quoting; T-SQL has no auto-type-preserving JSON
              //                aggregate so numeric lookups become quoted
              //                strings ("1" not 1). Acceptable tradeoff —
              //                lookups are display-oriented values.
              //   • STRING_ESCAPE — JSON-escapes embedded quotes/backslashes.
              //   • STRING_AGG — joins with `,` between the quoted elements.
              //   • COALESCE — STRING_AGG returns NULL for an empty/all-NULL
              //                input set; default to `''` so the wrapper
              //                yields `[]` rather than `[NULL]`.
              //   • JSON_QUERY — tells SQL Server the result IS JSON, so a
              //                parent `FOR JSON PATH` won't double-escape it.
              knex.raw(
                `JSON_QUERY('[' + COALESCE(STRING_AGG('"' + STRING_ESCAPE(RTRIM(CAST(?? AS NVARCHAR(MAX))), 'json') + '"', ','), '') + ']')`,
                [lookupColumn.id],
              ),
            )
            .from(selectQb.as(subQueryAlias)),
          applyCte,
        };
      } else if (baseModelSqlv2.isOracle) {
        // Match the JSON-array-string shape of pg's `json_agg(col)::text` /
        // mysql's `JSON_ARRAYAGG(col)`. `NULL ON NULL` keeps null elements
        // for pg parity (Oracle defaults to ABSENT ON NULL). RETURNING
        // VARCHAR2(4000) keeps the result usable as a sort/group key — CLOB
        // output can't be a comparison key (ORA-22848); an oversized
        // aggregate surfaces Oracle's own ORA-40478 rather than silently
        // truncating. CLOB-backed lookup values (LongText) are pre-shortened
        // via DBMS_LOB.SUBSTR — JSON_ARRAYAGG rejects LOB inputs when
        // returning VARCHAR2.
        const aggInput =
          (lookupColumn.dt ?? '').toLowerCase() === 'clob' ||
          (lookupColumn.dt ?? '').toLowerCase() === 'nclob'
            ? knex.raw('DBMS_LOB.SUBSTR(??, 2000, 1)', [lookupColumn.id])
            : knex.raw('??', [lookupColumn.id]);
        return {
          builder: knex
            .select(
              knex.raw(
                'JSON_ARRAYAGG(? NULL ON NULL RETURNING VARCHAR2(4000))',
                [aggInput],
              ),
            )
            .from(selectQb.as(subQueryAlias)),
          applyCte,
        };
      }

      NcError.get(context).notImplemented(
        'This operation on Lookup/LTAR for this database',
      );
    }
  }
}
