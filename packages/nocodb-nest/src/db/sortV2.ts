import { RelationTypes, UITypes } from 'nocodb-sdk';
import { Sort } from '../models';
import genRollupSelectv2 from './genRollupSelectv2';
import formulaQueryBuilderv2 from './formulav2/formulaQueryBuilderv2';
import { sanitize } from '../helpers/sqlSanitize';
import type { Knex } from 'knex';
import type { XKnex } from '../db/CustomKnex';
import {
  LinkToAnotherRecordColumn,
  RollupColumn,
  LookupColumn,
  FormulaColumn,
} from '../models';

export default async function sortV2(
  sortList: Sort[],
  qb: Knex.QueryBuilder,
  knex: XKnex,
) {
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
    if (!column) continue;
    const model = await column.getModel();

    const nulls = sort.direction === 'desc' ? 'LAST' : 'FIRST';

    switch (column.uidt) {
      case UITypes.Rollup:
        {
          const builder = (
            await genRollupSelectv2({
              knex,
              columnOptions: (await column.getColOptions()) as RollupColumn,
            })
          ).builder;

          qb.orderBy(builder, sort.direction || 'asc', nulls);
        }
        break;
      case UITypes.Formula:
        {
          const builder = (
            await formulaQueryBuilderv2(
              (
                await column.getColOptions<FormulaColumn>()
              ).formula,
              null,
              knex,
              model,
              column,
            )
          ).builder;
          qb.orderBy(builder, sort.direction || 'asc', nulls);
        }
        break;
      case UITypes.Lookup:
        {
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

              selectQb = knex(`${parentModel.table_name} as ${alias}`).where(
                `${alias}.${parentColumn.column_name}`,
                knex.raw(`??`, [
                  `${childModel.table_name}.${childColumn.column_name}`,
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
                `${parentModel.table_name} as ${nestedAlias}`,
                `${nestedAlias}.${parentColumn.column_name}`,
                `${prevAlias}.${childColumn.column_name}`,
              );

              lookupColumn = await nestedLookup.getLookupColumn();
              prevAlias = nestedAlias;
            }

            switch (lookupColumn.uidt) {
              case UITypes.Rollup:
                {
                  const builder = (
                    await genRollupSelectv2({
                      knex,
                      columnOptions:
                        (await lookupColumn.getColOptions()) as RollupColumn,
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
                      `${parentModel.table_name} as ${nestedAlias}`,
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
                      (
                        await column.getColOptions<FormulaColumn>()
                      ).formula,
                      null,
                      knex,
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

          const selectQb = knex(parentModel.table_name)
            .select(parentModel?.displayValue?.column_name)
            .where(
              `${parentModel.table_name}.${parentColumn.column_name}`,
              knex.raw(`??`, [
                `${childModel.table_name}.${childColumn.column_name}`,
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
