import { UITypes } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Knex } from 'knex';
import type { FormulaColumn, RollupColumn } from '~/models';
import { NcError } from '~/helpers/catchError';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { sanitize } from '~/helpers/sqlSanitize';
import { Base, BaseUser, Sort } from '~/models';
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
      case UITypes.LinkToAnotherRecord:
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
      case UITypes.User: {
        const base = await Base.get(model.base_id);
        const baseUsers = await BaseUser.getUsersList({
          base_id: base.id,
        });

        // create nested replace statement for each user
        const finalStatement = baseUsers.reduce((acc, user) => {
          const qb = knex.raw(`REPLACE(${acc}, ?, ?)`, [
            user.id,
            user.display_name || user.email,
          ]);
          return qb.toQuery();
        }, knex.raw(`??`, [column.column_name]).toQuery());

        qb.orderBy(
          sanitize(knex.raw(finalStatement)),
          sort.direction || 'asc',
          nulls,
        );

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
