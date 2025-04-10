import { RelationTypes, UITypes } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type { NcContext } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { FormulaQueryBuilderBaseParams } from '~/db/formulav2/formula-query-builder.types';
import type {
  FormulaColumn,
  LinkToAnotherRecordColumn,
  LookupColumn,
  RollupColumn,
} from '~/models';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { getAggregateFn } from '~/db/formulav2/formula-query-builder.helpers';

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
  async (parentColumns?: Set<string>): Promise<any> => {
    const {
      baseModelSqlv2,
      column,
      knex = baseModelSqlv2.dbDriver,
      context = baseModelSqlv2.context,
      tableAlias,
      model = baseModelSqlv2.model,
      _formulaQueryBuilder,
      getAliasCount,
    } = params;

    let selectQb;
    let isArray = false;
    const alias = `__nc_formula${getAliasCount()}`;
    const lookup =
      column.uidt === UITypes.Lookup
        ? await column.getColOptions<LookupColumn>(context)
        : null;
    {
      const relationCol = lookup
        ? await lookup.getRelationColumn(context)
        : column;
      const relation =
        await relationCol.getColOptions<LinkToAnotherRecordColumn>(context);
      // if (relation.type !== RelationTypes.BELONGS_TO) continue;

      const childColumn = await relation.getChildColumn(context);
      const parentColumn = await relation.getParentColumn(context);
      const childModel = await childColumn.getModel(context);
      await childModel.getColumns(context);
      const parentModel = await parentColumn.getModel(context);
      await parentModel.getColumns(context);

      let relationType = relation.type;

      if (relationType === RelationTypes.ONE_TO_ONE) {
        relationType = relationCol.meta?.bt
          ? RelationTypes.BELONGS_TO
          : RelationTypes.HAS_MANY;
      }
      let lookupColumn = lookup ? await lookup.getLookupColumn(context) : null;

      switch (relationType) {
        case RelationTypes.BELONGS_TO:
          selectQb = knex(
            knex.raw(`?? as ??`, [
              baseModelSqlv2.getTnPath(parentModel.table_name),
              alias,
            ]),
          ).where(
            `${alias}.${parentColumn.column_name}`,
            knex.raw(`??`, [
              `${
                tableAlias ?? baseModelSqlv2.getTnPath(childModel.table_name)
              }.${childColumn.column_name}`,
            ]),
          );
          lookupColumn = lookupColumn ?? parentModel.displayValue;
          break;
        case RelationTypes.HAS_MANY:
          isArray = relation.type !== RelationTypes.ONE_TO_ONE;
          selectQb = knex(
            knex.raw(`?? as ??`, [
              baseModelSqlv2.getTnPath(childModel.table_name),
              alias,
            ]),
          ).where(
            `${alias}.${childColumn.column_name}`,
            knex.raw(`??`, [
              `${
                tableAlias ?? baseModelSqlv2.getTnPath(parentModel.table_name)
              }.${parentColumn.column_name}`,
            ]),
          );
          lookupColumn = lookupColumn ?? childModel.displayValue;
          break;
        case RelationTypes.MANY_TO_MANY:
          {
            isArray = true;
            const mmModel = await relation.getMMModel(context);
            const mmParentColumn = await relation.getMMParentColumn(context);
            const mmChildColumn = await relation.getMMChildColumn(context);

            const assocAlias = `__nc${getAliasCount()}`;
            selectQb = knex(
              knex.raw(`?? as ??`, [
                baseModelSqlv2.getTnPath(parentModel.table_name),
                alias,
              ]),
            )
              .join(
                knex.raw(`?? as ??`, [
                  baseModelSqlv2.getTnPath(mmModel.table_name),
                  assocAlias,
                ]),
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
            lookupColumn = lookupColumn ?? parentModel.displayValue;
          }
          break;
      }

      let prevAlias = alias;
      while (lookupColumn.uidt === UITypes.Lookup) {
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

        const childColumn = await relation.getChildColumn(context);
        const parentColumn = await relation.getParentColumn(context);
        const childModel = await childColumn.getModel(context);
        await childModel.getColumns(context);
        const parentModel = await parentColumn.getModel(context);
        await parentModel.getColumns(context);

        let relationType = relation.type;

        if (relationType === RelationTypes.ONE_TO_ONE) {
          relationType = relationCol.meta?.bt
            ? RelationTypes.BELONGS_TO
            : RelationTypes.HAS_MANY;
        }

        switch (relationType) {
          case RelationTypes.BELONGS_TO:
            {
              selectQb.join(
                knex.raw(`?? as ??`, [
                  baseModelSqlv2.getTnPath(parentModel.table_name),
                  nestedAlias,
                ]),
                `${prevAlias}.${childColumn.column_name}`,
                `${nestedAlias}.${parentColumn.column_name}`,
              );
            }
            break;
          case RelationTypes.HAS_MANY:
            {
              isArray = relation.type !== RelationTypes.ONE_TO_ONE;
              selectQb.join(
                knex.raw(`?? as ??`, [
                  baseModelSqlv2.getTnPath(childModel.table_name),
                  nestedAlias,
                ]),
                `${prevAlias}.${parentColumn.column_name}`,
                `${nestedAlias}.${childColumn.column_name}`,
              );
            }
            break;
          case RelationTypes.MANY_TO_MANY: {
            isArray = true;
            const mmModel = await relation.getMMModel(context);
            const mmParentColumn = await relation.getMMParentColumn(context);
            const mmChildColumn = await relation.getMMChildColumn(context);

            const assocAlias = `__nc${getAliasCount()}`;

            selectQb
              .join(
                knex.raw(`?? as ??`, [
                  baseModelSqlv2.getTnPath(mmModel.table_name),
                  assocAlias,
                ]),
                `${assocAlias}.${mmChildColumn.column_name}`,
                `${prevAlias}.${childColumn.column_name}`,
              )
              .join(
                knex.raw(`?? as ??`, [
                  baseModelSqlv2.getTnPath(parentModel.table_name),
                  nestedAlias,
                ]),
                `${nestedAlias}.${parentColumn.column_name}`,
                `${assocAlias}.${mmParentColumn.column_name}`,
              );
          }
        }

        /*selectQb.join(
`${parentModel.title} as ${nestedAlias}`,
`${nestedAlias}.${parentColumn.title}`,
`${prevAlias}.${childColumn.title}`
);*/

        lookupColumn = await nestedLookup.getLookupColumn(context);
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
            const relation =
              await lookupColumn.getColOptions<LinkToAnotherRecordColumn>(
                context,
              );
            // if (relation.type !== RelationTypes.BELONGS_TO) continue;

            const colOptions = (await lookupColumn.getColOptions(
              context,
            )) as LinkToAnotherRecordColumn;
            const childColumn = await colOptions.getChildColumn(context);
            const parentColumn = await colOptions.getParentColumn(context);
            const childModel = await childColumn.getModel(context);
            await childModel.getColumns(context);
            const parentModel = await parentColumn.getModel(context);
            await parentModel.getColumns(context);
            let cn;

            let relationType = relation.type;

            if (relationType === RelationTypes.ONE_TO_ONE) {
              relationType = relationCol.meta?.bt
                ? RelationTypes.BELONGS_TO
                : RelationTypes.HAS_MANY;
            }

            switch (relationType) {
              case RelationTypes.BELONGS_TO:
                {
                  selectQb.join(
                    knex.raw(`?? as ??`, [
                      baseModelSqlv2.getTnPath(parentModel.table_name),
                      nestedAlias,
                    ]),
                    `${alias}.${childColumn.column_name}`,
                    `${nestedAlias}.${parentColumn.column_name}`,
                  );
                  cn = knex.raw('??.??', [
                    nestedAlias,
                    parentModel?.displayValue?.column_name,
                  ]);
                }
                break;
              case RelationTypes.HAS_MANY:
                {
                  isArray = relation.type !== RelationTypes.ONE_TO_ONE;
                  selectQb.join(
                    knex.raw(`?? as ??`, [
                      baseModelSqlv2.getTnPath(childModel.table_name),
                      nestedAlias,
                    ]),
                    `${alias}.${parentColumn.column_name}`,
                    `${nestedAlias}.${childColumn.column_name}`,
                  );
                  cn = knex.raw('??.??', [
                    nestedAlias,
                    childModel?.displayValue?.column_name,
                  ]);
                }
                break;
              case RelationTypes.MANY_TO_MANY:
                {
                  isArray = true;
                  const mmModel = await relation.getMMModel(context);
                  const mmParentColumn = await relation.getMMParentColumn(
                    context,
                  );
                  const mmChildColumn = await relation.getMMChildColumn(
                    context,
                  );

                  const assocAlias = `__nc${getAliasCount()}`;

                  selectQb
                    .join(
                      knex.raw(`?? as ??`, [
                        baseModelSqlv2.getTnPath(mmModel.table_name),
                        assocAlias,
                      ]),
                      `${assocAlias}.${mmChildColumn.column_name}`,
                      `${alias}.${childColumn.column_name}`,
                    )
                    .join(
                      knex.raw(`?? as ??`, [
                        baseModelSqlv2.getTnPath(parentModel.table_name),
                        nestedAlias,
                      ]),
                      `${nestedAlias}.${parentColumn.column_name}`,
                      `${assocAlias}.${mmParentColumn.column_name}`,
                    );
                }
                cn = knex.raw('??.??', [
                  nestedAlias,
                  parentModel?.displayValue?.column_name,
                ]);
            }

            selectQb.join(
              knex.raw(`?? as ??`, [
                baseModelSqlv2.getTnPath(parentModel.table_name),
                nestedAlias,
              ]),
              `${nestedAlias}.${parentColumn.column_name}`,
              `${prevAlias}.${childColumn.column_name}`,
            );

            if (isArray) {
              const qb = selectQb;
              selectQb = (fn) =>
                knex
                  .raw(
                    getAggregateFn(fn)({
                      qb,
                      knex,
                      cn: lookupColumn.column_name,
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
            if (parentColumns?.has(lookupColumn.id)) {
              NcError.formulaError('Circular reference detected', {
                details: {
                  columnId: lookupColumn.id,
                  modelId: model.id,
                  parentColumnIds: Array.from(parentColumns),
                },
              });
            }
            const { builder } = await _formulaQueryBuilder({
              ...params,
              _tree: formulaOption.formula,
              model: lookupModel,
              parsedTree: formulaOption.getParsedTree(),
              parentColumns: new Set([
                lookupColumn.id,
                ...(parentColumns ?? []),
              ]),
              tableAlias: prevAlias,
              column: lookupColumn,
            });
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

      if (selectQb)
        return {
          builder:
            typeof selectQb === 'function'
              ? selectQb
              : knex.raw(selectQb as any).wrap('(', ')'),
        };
    }
  };
