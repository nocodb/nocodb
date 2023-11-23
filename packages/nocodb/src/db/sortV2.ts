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
import generateLookupSelectQuery from '~/db/generateLookupSelectQuery';

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
        NcError.unprocessableEntity(`Invalid field: ${sort.fk_column_id}`);
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
            const selectQb = await generateLookupSelectQuery({
              baseModelSqlv2,
              column,
              alias: rootAlias,
              model,
            });

            qb.orderBy(selectQb?.builder, sort.direction || 'asc', nulls);
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
