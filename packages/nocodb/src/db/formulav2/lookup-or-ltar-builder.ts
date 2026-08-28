import {
  CircularRefContext,
  ClientType,
  isBtLikeV2Junction,
  isMMOrMMLike,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FormulaQueryBuilderBaseParams,
  TAliasToColumnParam,
} from '~/db/formulav2/formula-query-builder.types';
import type {
  BarcodeColumn,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  LookupColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import { extractLinkRelFiltersAndApply } from '~/db/conditionV2';
import { getAggregateFn } from '~/db/formulav2/formula-query-builder.helpers';
import { getDisplayValueOfRefTable } from '~/db/generateLookupSelectQuery';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import {
  applyLookupPkInLimit,
  applyNestedLookupLevelLimit,
  loadLookupSortAndLimit,
} from '~/db/lookupSortLimit';
import { getRefColumnIfAlias } from '~/helpers';
import { getAliasedSoftDeleteFilter } from '~/helpers/dbHelpers';
import { Model } from '~/models';
import { DBQueryClient } from '~/dbQueryClient';
import {
  buildLookupCteBlock,
  CTE_KEY,
  CTE_VALUE,
  lookupCteAlias,
} from '~/db/cte-generator/lookup.general.cte';

/**
 * Emit a lookup-onto-Formula target as a keyed CTE block and return a scalar
 * sub-query reading it. Keyed on the *formula* column, so two different
 * lookups pointing at the same target formula share one block.
 *
 * The block computes the formula against its own standalone alias; the chain
 * that reaches it stays correlated exactly as before, so nothing about hop
 * joins, soft-delete filters or junction handling changes.
 */
async function hoistFormulaLookup({
  cteScope,
  knex,
  context,
  dbQueryClient,
  lookupColumn,
  lookupModel,
  columns,
  formulaOption,
  parentColumns,
  params,
  _formulaQueryBuilder,
  prevAlias,
  blockAlias,
}: any): Promise<{ builder: any } | null> {
  const keyColumn = lookupModel.primaryKey?.column_name;
  // Without a single-column PK there is no key to join the block on.
  if (!keyColumn) return null;

  const alias = lookupCteAlias({ columnId: lookupColumn.id });
  const existing = cteScope.aliases.includes(alias);

  if (!existing) {
    const { builder: expr } = await _formulaQueryBuilder({
      ...params,
      _tree: formulaOption.formula,
      model: lookupModel,
      payload: { parsedTree: formulaOption.getParsedTree() },
      parentColumns,
      tableAlias: blockAlias,
      column: lookupColumn,
      columns,
    });

    const lookupBaseModel = await Model.getBaseModelSQL(context, {
      model: lookupModel,
      dbDriver: knex,
    });

    const select = knex(
      dbQueryClient.tableAlias(
        knex,
        lookupBaseModel.getTnPath(lookupModel.table_name),
        blockAlias,
      ),
    )
      .select(knex.raw('?? as ??', [`${blockAlias}.${keyColumn}`, CTE_KEY]))
      .select(knex.raw('? as ??', [expr, CTE_VALUE]));

    cteScope.add(buildLookupCteBlock({ alias, select }));
  }

  return {
    builder: knex.raw('(select ?? from ?? where ?? = ??)', [
      `${alias}.${CTE_VALUE}`,
      alias,
      `${alias}.${CTE_KEY}`,
      `${prevAlias}.${keyColumn}`,
    ]),
  };
}

export const lookupOrLtarBuilder =
  (
    params: FormulaQueryBuilderBaseParams & {
      context?: NcContext;
      knex?: CustomKnex;
      _formulaQueryBuilder: (
        params: FormulaQueryBuilderBaseParams,
      ) => Promise<{ builder: any }>;
    },
  ) =>
  async ({ tableAlias, parentColumns }: TAliasToColumnParam): Promise<any> => {
    const {
      baseModelSqlv2,
      column,
      knex = baseModelSqlv2.dbDriver,
      context = baseModelSqlv2.context,
      tableAlias: _tableAlias,
      //model = baseModelSqlv2.model,
      _formulaQueryBuilder,
      getAliasCount,
    } = params;

    const dbQueryClient = DBQueryClient.get(knex.clientType() as ClientType);

    let selectQb;
    let isArray = false;
    const alias = `__nc_formula${getAliasCount()}`;
    const lookup =
      column.uidt === UITypes.Lookup
        ? await column.getColOptions<LookupColumn>(context)
        : null;

    if (lookup?.error) {
      return { builder: knex.raw('?', [null]) };
    }
    {
      const relationCol = lookup
        ? await lookup.getRelationColumn(context)
        : column;
      const relation =
        await relationCol.getColOptions<LinkToAnotherRecordColumn>(context);
      // if (relation.type !== RelationTypes.BELONGS_TO) continue;

      const { parentContext, childContext, mmContext, refContext } =
        await relation.getParentChildContext(context);

      const childColumn = await relation.getChildColumn(childContext);
      const parentColumn = await relation.getParentColumn(parentContext);
      const childModel = await childColumn.getModel(childContext);
      await childModel.getColumns(childContext);
      const parentModel = await parentColumn.getModel(parentContext);
      await parentModel.getColumns(parentContext);

      let relationType = isMMOrMMLike(relationCol)
        ? RelationTypes.MANY_TO_MANY
        : relation.type;

      if (relationType === RelationTypes.ONE_TO_ONE) {
        relationType = relationCol.meta?.bt
          ? RelationTypes.BELONGS_TO
          : RelationTypes.HAS_MANY;
      }
      let lookupColumn = lookup
        ? await lookup.getLookupColumn(refContext)
        : null;

      switch (relationType) {
        case RelationTypes.BELONGS_TO:
          {
            const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
              model: parentModel,
              dbDriver: baseModelSqlv2.dbDriver,
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
                `${
                  tableAlias ?? baseModelSqlv2.getTnPath(childModel.table_name)
                }.${childColumn.column_name}`,
              ]),
            );
            lookupColumn =
              lookupColumn ??
              (await getDisplayValueOfRefTable(context, relationCol));

            await extractLinkRelFiltersAndApply({
              context,
              column,
              table: parentModel,
              baseModel: parentBaseModel,
              qb: selectQb,
              alias,
            });

            const btSoftDeleteFilter = await getAliasedSoftDeleteFilter(
              parentBaseModel,
              alias,
            );
            if (btSoftDeleteFilter) {
              selectQb.where(btSoftDeleteFilter);
            }
          }
          break;
        case RelationTypes.HAS_MANY:
          {
            const childBaseModel = await Model.getBaseModelSQL(childContext, {
              model: childModel,
              dbDriver: baseModelSqlv2.dbDriver,
            });
            isArray = relation.type !== RelationTypes.ONE_TO_ONE;
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
                  tableAlias ?? baseModelSqlv2.getTnPath(parentModel.table_name)
                }.${parentColumn.column_name}`,
              ]),
            );
            lookupColumn =
              lookupColumn ??
              (await getDisplayValueOfRefTable(context, relationCol));

            await extractLinkRelFiltersAndApply({
              context,
              column,
              table: childModel,
              baseModel: childBaseModel,
              qb: selectQb,
              alias,
            });

            const hmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
              childBaseModel,
              alias,
            );
            if (hmSoftDeleteFilter) {
              selectQb.where(hmSoftDeleteFilter);
            }
          }
          break;
        case RelationTypes.MANY_TO_MANY:
          {
            const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
              model: parentModel,
              dbDriver: baseModelSqlv2.dbDriver,
            });
            const isSingleTargetV2 = isBtLikeV2Junction(relationCol);
            isArray = !isSingleTargetV2;
            const mmModel = await relation.getMMModel(context);
            const mmParentColumn = await relation.getMMParentColumn(context);
            const mmChildColumn = await relation.getMMChildColumn(context);
            const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
              model: mmModel,
              dbDriver: baseModelSqlv2.dbDriver,
            });

            const assocAlias = `__nc${getAliasCount()}`;
            selectQb = knex(
              dbQueryClient.tableAlias(
                knex,
                parentBaseModel.getTnPath(parentModel.table_name),
                alias,
              ),
            )
              .join(
                dbQueryClient.tableAlias(
                  knex,
                  mmBaseModel.getTnPath(mmModel.table_name),
                  assocAlias,
                ),
                `${assocAlias}.${mmParentColumn.column_name}`,
                `${alias}.${parentColumn.column_name}`,
              )
              .where(
                `${assocAlias}.${mmChildColumn.column_name}`,
                knex.raw(`??`, [
                  `${
                    tableAlias ??
                    baseModelSqlv2.getTnPath(childModel.table_name)
                  }.${childColumn.column_name}`,
                ]),
              );

            if (isSingleTargetV2) {
              selectQb.limit(1);
            }

            // Per-link ordering (PG only): stash the junction Order column ref
            // (current side) on the row query so the aggregate (getAggregateFn →
            // concat) can ORDER BY it. Absent for non-PG / v1 / external links.
            // Only as the DEFAULT order — if this lookup has its own sort/limit
            // config, that ordering wins, so skip the link order to avoid
            // overriding it.
            if (baseModelSqlv2.isPg) {
              const lookupCfg = await loadLookupSortAndLimit(context, column);
              const linkOrderCol = lookupCfg.hasConfig
                ? null
                : await relation.getMMChildOrderColumn(context);
              if (linkOrderCol) {
                (selectQb as any)._ncLinkOrderRef = knex.raw('??', [
                  `${assocAlias}.${linkOrderCol.column_name}`,
                ]);
              }
            }

            lookupColumn =
              lookupColumn ??
              (await getDisplayValueOfRefTable(context, relationCol));

            await extractLinkRelFiltersAndApply({
              context,
              column,
              table: parentModel,
              baseModel: parentBaseModel,
              qb: selectQb,
              alias,
            });

            const mmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
              parentBaseModel,
              alias,
            );
            if (mmSoftDeleteFilter) {
              selectQb.where(mmSoftDeleteFilter);
            }
          }
          break;
      }

      let prevAlias = alias;
      // set initial lookup context
      let lookupContext = refContext;
      const singleLevelLookupCol = lookupColumn;

      // Per-lookup Limit — OUTER level (PG): restrict the first-level relation
      // rows a formula sees to the configured top-N BEFORE any nested joins,
      // correlated to the root row. Applies to single-level lookups and the
      // outer level of nested ones (the pk-IN survives the nested joins below).
      // selectQb is still a plain builder here (it only becomes a function in
      // the terminal switch after the loop).
      if (
        column.uidt === UITypes.Lookup &&
        baseModelSqlv2.isPg &&
        typeof (selectQb as any)?.clone === 'function'
      ) {
        const cfg = await loadLookupSortAndLimit(context, column);
        if (cfg.hasConfig && cfg.limitVal > 0) {
          const refModel = await singleLevelLookupCol.getModel(refContext);
          const refBaseModel = await Model.getBaseModelSQL(refContext, {
            model: refModel,
            dbDriver: knex,
          });
          await applyLookupPkInLimit({
            qb: selectQb,
            alias,
            refBaseModel,
            sorts: cfg.sorts,
            limitVal: cfg.limitVal,
            takeLast: cfg.takeLast,
          });
        }
      }

      while (lookupColumn.uidt === UITypes.Lookup) {
        // overwrite lookupContext from previous iteration
        const context = lookupContext;
        const nestedAlias = `__nc_formula${getAliasCount()}`;
        const nestedLookup = await lookupColumn.getColOptions<LookupColumn>(
          context,
        );
        const relationCol = await nestedLookup.getRelationColumn(context);
        const relation =
          await relationCol.getColOptions<LinkToAnotherRecordColumn>(context);
        // if any of the relation in nested lookup is
        // not belongs to then ignore the sort option
        // if (relation.type !== RelationTypes.BELONGS_TO) continue;

        const { parentContext, childContext, refContext, mmContext } =
          await relation.getParentChildContext(context);
        // reset for next iteration
        lookupContext = refContext;

        const childColumn = await relation.getChildColumn(childContext);
        const parentColumn = await relation.getParentColumn(parentContext);
        const childModel = await childColumn.getModel(childContext);
        await childModel.getColumns(childContext);
        const parentModel = await parentColumn.getModel(parentContext);
        await parentModel.getColumns(parentContext);

        const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
          model: parentModel,
          dbDriver: baseModelSqlv2.dbDriver,
        });
        const childBaseModel = await Model.getBaseModelSQL(childContext, {
          model: childModel,
          dbDriver: baseModelSqlv2.dbDriver,
        });

        let relationType = isMMOrMMLike(relationCol)
          ? RelationTypes.MANY_TO_MANY
          : relation.type;

        if (relationType === RelationTypes.ONE_TO_ONE) {
          relationType = relationCol.meta?.bt
            ? RelationTypes.BELONGS_TO
            : RelationTypes.HAS_MANY;
        }

        switch (relationType) {
          case RelationTypes.BELONGS_TO:
            {
              selectQb.join(
                dbQueryClient.tableAlias(
                  knex,
                  parentBaseModel.getTnPath(parentModel.table_name),
                  nestedAlias,
                ),
                `${prevAlias}.${childColumn.column_name}`,
                `${nestedAlias}.${parentColumn.column_name}`,
              );

              await extractLinkRelFiltersAndApply({
                context,
                column: lookupColumn,
                table: parentModel,
                baseModel: parentBaseModel,
                qb: selectQb,
                // this nested level's related table is joined as `nestedAlias`,
                // not the first-level `alias` — see the mm-lookup filter fix.
                alias: nestedAlias,
              });

              const nestedBtSoftDeleteFilter = await getAliasedSoftDeleteFilter(
                parentBaseModel,
                nestedAlias,
              );
              if (nestedBtSoftDeleteFilter) {
                selectQb.where(nestedBtSoftDeleteFilter);
              }

              // INNER-level limit for a nested lookup (BT): restrict this
              // level's joined rows to the top-N per the previous level's row.
              if (baseModelSqlv2.isPg && nestedLookup) {
                const cfg = await loadLookupSortAndLimit(context, lookupColumn);
                if (cfg.hasConfig && cfg.limitVal > 0) {
                  await applyNestedLookupLevelLimit({
                    qb: selectQb,
                    nestedAlias,
                    nestedRefBaseModel: parentBaseModel,
                    corrColName: parentColumn.column_name,
                    prevAlias,
                    prevCorrColName: childColumn.column_name,
                    sorts: cfg.sorts,
                    limitVal: cfg.limitVal,
                    takeLast: cfg.takeLast,
                  });
                }
              }
            }
            break;
          case RelationTypes.HAS_MANY:
            {
              isArray = relation.type !== RelationTypes.ONE_TO_ONE;
              selectQb.join(
                dbQueryClient.tableAlias(
                  knex,
                  childBaseModel.getTnPath(childModel.table_name),
                  nestedAlias,
                ),
                `${prevAlias}.${parentColumn.column_name}`,
                `${nestedAlias}.${childColumn.column_name}`,
              );

              await extractLinkRelFiltersAndApply({
                context,
                column: lookupColumn,
                table: childModel,
                baseModel: childBaseModel,
                qb: selectQb,
                // this nested level's related table is joined as `nestedAlias`,
                // not the first-level `alias` — see the mm-lookup filter fix.
                alias: nestedAlias,
              });

              const nestedHmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
                childBaseModel,
                nestedAlias,
              );
              if (nestedHmSoftDeleteFilter) {
                selectQb.where(nestedHmSoftDeleteFilter);
              }

              // INNER-level limit for a nested lookup (HM): restrict this
              // level's joined rows to the top-N per the previous level's row.
              if (baseModelSqlv2.isPg && nestedLookup) {
                const cfg = await loadLookupSortAndLimit(context, lookupColumn);
                if (cfg.hasConfig && cfg.limitVal > 0) {
                  await applyNestedLookupLevelLimit({
                    qb: selectQb,
                    nestedAlias,
                    nestedRefBaseModel: childBaseModel,
                    corrColName: childColumn.column_name,
                    prevAlias,
                    prevCorrColName: parentColumn.column_name,
                    sorts: cfg.sorts,
                    limitVal: cfg.limitVal,
                    takeLast: cfg.takeLast,
                  });
                }
              }
            }
            break;
          case RelationTypes.MANY_TO_MANY: {
            const nestedIsSingleTargetV2 = isBtLikeV2Junction(relationCol);
            isArray = !nestedIsSingleTargetV2;
            const mmModel = await relation.getMMModel(mmContext);
            const mmParentColumn = await relation.getMMParentColumn(mmContext);
            const mmChildColumn = await relation.getMMChildColumn(mmContext);

            const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
              model: mmModel,
              dbDriver: baseModelSqlv2.dbDriver,
            });

            const assocAlias = `__nc${getAliasCount()}`;

            selectQb
              .join(
                dbQueryClient.tableAlias(
                  knex,
                  mmBaseModel.getTnPath(mmModel.table_name),
                  assocAlias,
                ),
                `${assocAlias}.${mmChildColumn.column_name}`,
                `${prevAlias}.${childColumn.column_name}`,
              )
              .join(
                dbQueryClient.tableAlias(
                  knex,
                  parentBaseModel.getTnPath(parentModel.table_name),
                  nestedAlias,
                ),
                `${nestedAlias}.${parentColumn.column_name}`,
                `${assocAlias}.${mmParentColumn.column_name}`,
              );

            await extractLinkRelFiltersAndApply({
              context,
              column: lookupColumn,
              table: parentModel,
              baseModel: parentBaseModel,
              qb: selectQb,
              // this nested level's related table is joined as `nestedAlias`,
              // not the first-level `alias` — see the mm-lookup filter fix.
              alias: nestedAlias,
            });

            const nestedMmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
              parentBaseModel,
              nestedAlias,
            );
            if (nestedMmSoftDeleteFilter) {
              selectQb.where(nestedMmSoftDeleteFilter);
            }
          }
        }

        /*selectQb.join(
`${parentModel.title} as ${nestedAlias}`,
`${nestedAlias}.${parentColumn.title}`,
`${prevAlias}.${childColumn.title}`
);*/

        lookupColumn = await nestedLookup.getLookupColumn(refContext);
        prevAlias = nestedAlias;
      }

      switch (lookupColumn.uidt) {
        case UITypes.Links:
        case UITypes.Rollup:
          {
            const builder = (
              await genRollupSelectv2({
                baseModelSqlv2,
                knex,
                alias: prevAlias,
                columnOptions: (await lookupColumn.getColOptions(
                  context,
                )) as RollupColumn,
                parentColumns,
              })
            ).builder;
            // selectQb.select(builder);

            if (isArray) {
              const qb = selectQb;
              selectQb = (fn) =>
                knex
                  .raw(
                    getAggregateFn(fn)({
                      qb,
                      knex,
                      cn: knex.raw(builder).wrap('(', ')'),
                    }),
                  )
                  .wrap('(', ')');
            } else {
              selectQb.select(knex.raw(builder).wrap('(', ')'));
            }
          }
          break;
        case UITypes.LinkToAnotherRecord:
          {
            const nestedAlias = `__nc_formula${getAliasCount()}`;
            const isMMLike = isMMOrMMLike(lookupColumn);
            const relation =
              await lookupColumn.getColOptions<LinkToAnotherRecordColumn>(
                context,
              );

            const { parentContext, childContext, mmContext } =
              await relation.getParentChildContext(context);

            const colOptions = (await lookupColumn.getColOptions(
              context,
            )) as LinkToAnotherRecordColumn;
            const childColumn = await colOptions.getChildColumn(childContext);
            const parentColumn = await colOptions.getParentColumn(
              parentContext,
            );
            const childModel = await childColumn.getModel(childContext);
            await childModel.getColumns(childContext);
            const parentModel = await parentColumn.getModel(parentContext);
            await parentModel.getColumns(parentContext);

            const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
              model: parentModel,
              dbDriver: baseModelSqlv2.dbDriver,
            });
            const childBaseModel = await Model.getBaseModelSQL(childContext, {
              model: childModel,
              dbDriver: baseModelSqlv2.dbDriver,
            });

            let cn;

            let relationType = isMMLike
              ? RelationTypes.MANY_TO_MANY
              : relation.type;

            if (relationType === RelationTypes.ONE_TO_ONE) {
              // direction comes from the terminal LTAR being resolved, not
              // the first-hop relation column
              relationType = lookupColumn.meta?.bt
                ? RelationTypes.BELONGS_TO
                : RelationTypes.HAS_MANY;
            }

            // Resolve display column once — honors fk_display_value_column_id.
            // Must be resolved from the terminal LTAR (lookupColumn), whose
            // related table the joins below read from — resolving from the
            // first-hop relationCol picked a column of the wrong table.
            const nestedDisplayCol = await getDisplayValueOfRefTable(
              context,
              lookupColumn,
            );

            switch (relationType) {
              case RelationTypes.BELONGS_TO:
                {
                  selectQb.join(
                    dbQueryClient.tableAlias(
                      knex,
                      parentBaseModel.getTnPath(parentModel.table_name),
                      nestedAlias,
                    ),
                    `${alias}.${childColumn.column_name}`,
                    `${nestedAlias}.${parentColumn.column_name}`,
                  );
                  cn = knex.raw('??.??', [
                    nestedAlias,
                    nestedDisplayCol?.column_name,
                  ]);
                }
                break;
              case RelationTypes.HAS_MANY:
                {
                  isArray = relation.type !== RelationTypes.ONE_TO_ONE;
                  selectQb.join(
                    dbQueryClient.tableAlias(
                      knex,
                      childBaseModel.getTnPath(childModel.table_name),
                      nestedAlias,
                    ),
                    `${alias}.${parentColumn.column_name}`,
                    `${nestedAlias}.${childColumn.column_name}`,
                  );
                  cn = knex.raw('??.??', [
                    nestedAlias,
                    nestedDisplayCol?.column_name,
                  ]);
                }
                break;
              case RelationTypes.MANY_TO_MANY:
                {
                  isArray = true;
                  const mmModel = await relation.getMMModel(mmContext);
                  const mmParentColumn = await relation.getMMParentColumn(
                    mmContext,
                  );
                  const mmChildColumn = await relation.getMMChildColumn(
                    mmContext,
                  );

                  const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
                    model: mmModel,
                    dbDriver: baseModelSqlv2.dbDriver,
                  });

                  const assocAlias = `__nc${getAliasCount()}`;

                  selectQb
                    .join(
                      dbQueryClient.tableAlias(
                        knex,
                        mmBaseModel.getTnPath(mmModel.table_name),
                        assocAlias,
                      ),
                      `${assocAlias}.${mmChildColumn.column_name}`,
                      `${alias}.${childColumn.column_name}`,
                    )
                    .join(
                      dbQueryClient.tableAlias(
                        knex,
                        parentBaseModel.getTnPath(parentModel.table_name),
                        nestedAlias,
                      ),
                      `${nestedAlias}.${parentColumn.column_name}`,
                      `${assocAlias}.${mmParentColumn.column_name}`,
                    );
                }
                cn = knex.raw('??.??', [
                  nestedAlias,
                  nestedDisplayCol?.column_name,
                ]);
            }

            if (isArray) {
              const qb = selectQb;
              selectQb = (fn) =>
                knex
                  .raw(
                    getAggregateFn(fn)({
                      qb,
                      knex,
                      cn: cn ?? lookupColumn.column_name,
                    }),
                  )
                  .wrap('(', ')');
            } else {
              selectQb.select(`${prevAlias}.${cn}`);
            }
          }
          break;
        case UITypes.Formula:
          {
            const formulaOption =
              await lookupColumn.getColOptions<FormulaColumn>(context);
            const lookupModel = await lookupColumn.getModel(context);
            const columns = await lookupModel.getColumns(context);
            parentColumns = (
              parentColumns ?? CircularRefContext.make()
            ).cloneAndAdd({
              id: lookupColumn.id,
              title: lookupColumn.title,
              table: lookupModel?.title,
            });

            // This is where generated SQL multiplies: embedding the target
            // formula inlines its whole expression, whose own lookups inline
            // theirs. Hoisted, each target formula is written once as a keyed
            // block and every reference site shrinks to a scalar sub-query.
            // The recursive `_formulaQueryBuilder` call carries the scope, so
            // deeper alternation levels hoist themselves.
            const hoisted = params.cteScope
              ? await hoistFormulaLookup({
                  cteScope: params.cteScope,
                  knex,
                  context,
                  dbQueryClient,
                  lookupColumn,
                  lookupModel,
                  columns,
                  formulaOption,
                  parentColumns,
                  params,
                  _formulaQueryBuilder,
                  prevAlias,
                  blockAlias: `__nc_cte${getAliasCount()}`,
                })
              : null;

            const { builder } =
              hoisted ??
              (await _formulaQueryBuilder({
                ...params,
                _tree: formulaOption.formula,
                model: lookupModel,
                payload: { parsedTree: formulaOption.getParsedTree() },
                parentColumns,
                tableAlias: prevAlias,
                column: lookupColumn,
                columns,
              }));
            if (isArray) {
              const qb = selectQb;
              selectQb = (fn) =>
                knex
                  .raw(
                    getAggregateFn(fn)({
                      qb,
                      knex,
                      cn: knex.raw(builder).wrap('(', ')'),
                    }),
                  )
                  .wrap('(', ')');
            } else {
              selectQb.select(builder);
            }
          }
          break;
        case UITypes.Barcode:
        case UITypes.QrCode: {
          const referenceColumn = await (
            await lookupColumn.getColOptions<BarcodeColumn | QrCodeColumn>(
              refContext,
            )
          ).getValueColumn(refContext);

          if (isArray) {
            const qb = selectQb;
            selectQb = (fn) =>
              knex
                .raw(
                  getAggregateFn(fn)({
                    qb,
                    knex,
                    cn: `${prevAlias}.${referenceColumn.column_name}`,
                  }),
                )
                .wrap('(', ')');
          } else {
            selectQb.select(`${prevAlias}.${referenceColumn.column_name}`);
          }
          break;
        }
        case UITypes.CreatedBy:
        case UITypes.LastModifiedBy:
        case UITypes.CreatedTime:
        case UITypes.LastModifiedTime: {
          const refCol = await getRefColumnIfAlias(context, lookupColumn);
          if (isArray) {
            const qb = selectQb;
            selectQb = (fn) =>
              knex
                .raw(
                  getAggregateFn(fn)({
                    qb,
                    knex,
                    cn: `${prevAlias}.${refCol.column_name}`,
                  }),
                )
                .wrap('(', ')');
          } else {
            selectQb.select(`${prevAlias}.${refCol.column_name}`);
          }
          break;
        }
        case UITypes.Attachment: {
          {
            if (isArray) {
              const qb = selectQb;
              const cn = `${prevAlias}.${lookupColumn.column_name}`;
              selectQb = (fn) => {
                console.log('fn', fn, knex.clientType());
                if (
                  knex.clientType() === ClientType.PG &&
                  (!fn || fn.toLowerCase?.() === 'concat')
                ) {
                  return knex
                    .raw(
                      [
                        `select jsonb_agg(__elem)::text`,
                        `from (`,
                        `  ??`,
                        `) t`,
                        `cross join lateral jsonb_array_elements(__val::jsonb) as __elem`,
                      ].join(' '),
                      [
                        qb
                          .clear('select')
                          .select(knex.raw('?? as __val', [cn])),
                      ],
                    )
                    .wrap('(', ')');
                } else {
                  return knex
                    .raw(
                      getAggregateFn(fn)({
                        qb,
                        knex,
                        cn: `${prevAlias}.${lookupColumn.column_name}`,
                      }),
                    )
                    .wrap('(', ')');
                }
              };
            } else {
              selectQb.select(`${prevAlias}.${lookupColumn.column_name}`);
            }
          }

          break;
        }
        default:
          {
            if (isArray) {
              const qb = selectQb;
              selectQb = (fn) =>
                knex
                  .raw(
                    getAggregateFn(fn)({
                      qb,
                      knex,
                      cn: `${prevAlias}.${lookupColumn.column_name}`,
                    }),
                  )
                  .wrap('(', ')');
            } else {
              selectQb.select(`${prevAlias}.${lookupColumn.column_name}`);
            }
          }

          break;
      }

      if (selectQb) {
        return {
          builder:
            typeof selectQb === 'function'
              ? selectQb
              : knex.raw(selectQb as any).wrap('(', ')'),
        };
      }
    }
  };
