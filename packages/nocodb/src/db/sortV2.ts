import { isAIPromptCol, UITypes } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Knex } from 'knex';
import type { ButtonColumn, FormulaColumn, RollupColumn } from '~/models';
import { Base, BaseUser, Sort } from '~/models';
import { NcError } from '~/helpers/catchError';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { sanitize } from '~/helpers/sqlSanitize';
import generateLookupSelectQuery from '~/db/generateLookupSelectQuery';
import { getRefColumnIfAlias } from '~/helpers';

export default async function sortV2(
  baseModelSqlv2: BaseModelSqlv2,
  sortList: Sort[],
  qb: Knex.QueryBuilder,
  alias?: string,
  throwErrorIfInvalid = false,
) {
  const knex = baseModelSqlv2.dbDriver;

  const context = baseModelSqlv2.context;

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
    const column = await getRefColumnIfAlias(
      context,
      await sort.getColumn(context),
    );
    if (!column) {
      if (throwErrorIfInvalid) {
        NcError.fieldNotFound(sort.fk_column_id);
      }
      continue;
    }
    const model = await column.getModel(context);

    const nulls = sort.direction === 'desc' ? 'LAST' : 'FIRST';

    switch (column.uidt) {
      case UITypes.Rollup:
      case UITypes.Links:
        {
          const builder = (
            await genRollupSelectv2({
              baseModelSqlv2,
              knex,
              columnOptions: (await column.getColOptions(
                context,
              )) as RollupColumn,
              alias,
            })
          ).builder;

          qb.orderBy(builder, sort.direction || 'asc', nulls);
        }
        break;
      case UITypes.Formula:
      case UITypes.Button:
        {
          const formulaOptions = await column.getColOptions<
            FormulaColumn | ButtonColumn
          >(context);

          if (
            column.uidt === UITypes.Formula ||
            (column.uidt === UITypes.Button &&
              (formulaOptions as ButtonColumn).type === 'url')
          ) {
            const parsedTree = formulaOptions.getParsedTree();
            // if static value order by a static number to avoid error
            if (parsedTree?.type === 'Literal') {
              qb.orderBy(
                knex.raw('?', [1]) as any,
                sort.direction || 'asc',
                nulls,
              );
              break;
            }
            const builder = (
              await formulaQueryBuilderv2(
                baseModelSqlv2,
                formulaOptions.formula,
                null,
                model,
                column,
                {},
                alias,
              )
            ).builder;
            qb.orderBy(builder, sort.direction || 'asc', nulls);
          } else {
            // The fk_webhook_id is a static value
            qb.orderBy(
              knex.raw('?', [1]) as any,
              sort.direction || 'asc',
              nulls,
            );
          }
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
      case UITypes.User:
      case UITypes.CreatedBy:
      case UITypes.LastModifiedBy: {
        const base = await Base.get(context, model.base_id);
        const baseUsers = await BaseUser.getUsersList(context, {
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
      case UITypes.LongText: {
        if (isAIPromptCol(column)) {
          let col;
          if (knex.clientType() === 'pg') {
            col = knex.raw(`TRIM('"' FROM (??::jsonb->>'value'))`, [
              column.column_name,
            ]);
          } else if (knex.clientType().startsWith('mysql')) {
            col = knex.raw(`JSON_UNQUOTE(JSON_EXTRACT(??, '$.value'))`, [
              column.column_name,
            ]);
          } else if (knex.clientType() === 'sqlite3') {
            col = knex.raw(`json_extract(??, '$.value')`, [column.column_name]);
          } else if (knex.clientType() === 'mssql') {
            col = knex.raw(`JSON_VALUE(??, '$.value')`, [column.column_name]);
          }

          qb.orderBy(col, sort.direction || 'asc', nulls);
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
