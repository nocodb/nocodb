import { RelationTypes, UITypes } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Knex } from 'knex';
import type {
  FormulaColumn,
  LinkToAnotherRecordColumn,
  LookupColumn,
  RollupColumn,
} from '~/models';
import { NcError } from '~/helpers/catchError';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { sanitize } from '~/helpers/sqlSanitize';
import { Sort } from '~/models';

export default async function sortV2(
  baseModelSqlv2: BaseModelSqlv2,
  sortList: Sort[],
  qb: Knex.QueryBuilder,
  alias?: string,
  throwErrorIfInvalid = false,
) {
  const knex = baseModelSqlv2.dbDriver;

  if (!sortList?.length) {
    return;
  }

  for (const _sort of sortList) {
    let sort: Sort;
    if (_sort instanceof Sort) {
      sort = _sort;
    } else {
      sort = new Sort(_sort);
    }
    const column = await sort.getColumn();
    if (!column) {
      if (throwErrorIfInvalid) {
        NcError.unprocessableEntity(
          `Invalid column id '${sort.fk_column_id}' in sort`,
        );
      }
      continue;
    }
    const model = await column.getModel();

    const nulls = sort.direction === 'desc' ? 'LAST' : 'FIRST';

    switch (column.uidt) {
      case UITypes.Rollup:
      case UITypes.Links:
        {
          const builder = (
            await genRollupSelectv2({
              baseModelSqlv2,
              knex,
              columnOptions: (await column.getColOptions()) as RollupColumn,
              alias,
            })
          ).builder;

          qb.orderBy(builder, sort.direction || 'asc', nulls);
        }
        break;
      case UITypes.Formula:
        {
          const builder = (
            await formulaQueryBuilderv2(
              baseModelSqlv2,
              (
                await column.getColOptions<FormulaColumn>()
              ).formula,
              alias,
              model,
              column,
            )
          ).builder;
          qb.orderBy(builder, sort.direction || 'asc', nulls);
        }
        break;
      case UITypes.Lookup:
        {
          const rootAlias = alias;
          {
            let aliasCount = 0,
              selectQb;
            const alias = `__nc_sort${aliasCount++}`;
            const lookup = await column.getColOptions<LookupColumn>();
            {
              const relationCol = await lookup.getRelationColumn();
              const relation =
                await relationCol.getColOptions<LinkToAnotherRecordColumn>();
              if (relation.type !== RelationTypes.BELONGS_TO) return;

              const childColumn = await relation.getChildColumn();
              const parentColumn = await relation.getParentColumn();
              const childModel = await childColumn.getModel();
              await childModel.getColumns();
              const parentModel = await parentColumn.getModel();
              await parentModel.getColumns();

              selectQb = knex(
                `${baseModelSqlv2.getTnPath(
                  parentModel.table_name,
                )} as ${alias}`,
              ).where(
                `${alias}.${parentColumn.column_name}`,
                knex.raw(`??`, [
                  `${
                    rootAlias || baseModelSqlv2.getTnPath(childModel.table_name)
                  }.${childColumn.column_name}`,
                ]),
              );
            }
            let lookupColumn = await lookup.getLookupColumn();
            let prevAlias = alias;
            while (lookupColumn.uidt === UITypes.Lookup) {
              const nestedAlias = `__nc_sort${aliasCount++}`;
              const nestedLookup =
                await lookupColumn.getColOptions<LookupColumn>();
              const relationCol = await nestedLookup.getRelationColumn();
              const relation =
                await relationCol.getColOptions<LinkToAnotherRecordColumn>();
              // if any of the relation in nested lookup is
              // not belongs to then ignore the sort option
              if (relation.type !== 'bt') return;

              const childColumn = await relation.getChildColumn();
              const parentColumn = await relation.getParentColumn();
              const childModel = await childColumn.getModel();
              await childModel.getColumns();
              const parentModel = await parentColumn.getModel();
              await parentModel.getColumns();

              selectQb.join(
                `${baseModelSqlv2.getTnPath(
                  parentModel.table_name,
                )} as ${nestedAlias}`,
                `${nestedAlias}.${parentColumn.column_name}`,
                `${prevAlias}.${childColumn.column_name}`,
              );

              lookupColumn = await nestedLookup.getLookupColumn();
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
                      columnOptions:
                        (await lookupColumn.getColOptions()) as RollupColumn,
                      alias: prevAlias,
                    })
                  ).builder;
                  selectQb.select(builder);
                }
                break;
              case UITypes.LinkToAnotherRecord:
                {
                  const nestedAlias = `__nc_sort${aliasCount++}`;
                  const relation =
                    await lookupColumn.getColOptions<LinkToAnotherRecordColumn>();
                  if (relation.type !== 'bt') return;

                  const colOptions =
                    (await column.getColOptions()) as LinkToAnotherRecordColumn;
                  const childColumn = await colOptions.getChildColumn();
                  const parentColumn = await colOptions.getParentColumn();
                  const childModel = await childColumn.getModel();
                  await childModel.getColumns();
                  const parentModel = await parentColumn.getModel();
                  await parentModel.getColumns();

                  selectQb
                    .join(
                      `${baseModelSqlv2.getTnPath(
                        parentModel.table_name,
                      )} as ${nestedAlias}`,
                      `${nestedAlias}.${parentColumn.column_name}`,
                      `${prevAlias}.${childColumn.column_name}`,
                    )
                    .select(parentModel?.displayValue?.column_name);
                }
                break;
              case UITypes.Formula:
                {
                  const builder = (
                    await formulaQueryBuilderv2(
                      baseModelSqlv2,
                      (
                        await column.getColOptions<FormulaColumn>()
                      ).formula,
                      null,
                      model,
                      column,
                    )
                  ).builder;

                  selectQb.select(builder);
                }
                break;
              default:
                {
                  selectQb.select(`${prevAlias}.${lookupColumn.column_name}`);
                }

                break;
            }

            qb.orderBy(selectQb, sort.direction || 'asc', nulls);
          }
        }
        break;
      case UITypes.LinkToAnotherRecord:
        {
          const relation =
            await column.getColOptions<LinkToAnotherRecordColumn>();
          if (relation.type !== 'bt') return;

          const colOptions =
            (await column.getColOptions()) as LinkToAnotherRecordColumn;
          const childColumn = await colOptions.getChildColumn();
          const parentColumn = await colOptions.getParentColumn();
          const childModel = await childColumn.getModel();
          await childModel.getColumns();
          const parentModel = await parentColumn.getModel();
          await parentModel.getColumns();

          const selectQb = knex(
            baseModelSqlv2.getTnPath(parentModel.table_name),
          )
            .select(parentModel?.displayValue?.column_name)
            .where(
              `${baseModelSqlv2.getTnPath(parentModel.table_name)}.${
                parentColumn.column_name
              }`,
              knex.raw(`??`, [
                `${baseModelSqlv2.getTnPath(childModel.table_name)}.${
                  childColumn.column_name
                }`,
              ]),
            );

          qb.orderBy(selectQb, sort.direction || 'asc', nulls);
        }
        break;
      case UITypes.SingleSelect: {
        const clientType = knex.clientType();
        if (clientType === 'mysql' || clientType === 'mysql2') {
          qb.orderBy(
            sanitize(knex.raw('CONCAT(??)', [column.column_name])),
            sort.direction || 'asc',
            nulls,
          );
        } else if (clientType === 'mssql') {
          qb.orderBy(
            sanitize(
              knex.raw('CAST(?? AS VARCHAR(MAX))', [column.column_name]),
            ),
            sort.direction || 'asc',
            nulls,
          );
        } else {
          qb.orderBy(
            sanitize(column.column_name),
            sort.direction || 'asc',
            nulls,
          );
        }
        break;
      }
      case UITypes.MultiSelect: {
        const clientType = knex.clientType();
        if (clientType === 'mysql' || clientType === 'mysql2') {
          qb.orderBy(
            sanitize(knex.raw('CONCAT(??)', [column.column_name])),
            sort.direction || 'asc',
            nulls,
          );
        } else if (clientType === 'mssql') {
          qb.orderBy(
            sanitize(
              knex.raw('CAST(?? AS VARCHAR(MAX))', [column.column_name]),
            ),
            sort.direction || 'asc',
            nulls,
          );
        } else {
          qb.orderBy(
            sanitize(column.column_name),
            sort.direction || 'asc',
            nulls,
          );
        }
        break;
      }
      default:
        qb.orderBy(
          sanitize(column.column_name),
          sort.direction || 'asc',
          nulls,
        );
        break;
    }
  }
}
