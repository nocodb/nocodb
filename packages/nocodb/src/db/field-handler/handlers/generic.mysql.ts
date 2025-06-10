import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FieldHandlerInterface,
  FilterOperationHandlers,
  FilterOptions,
} from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class GenericMysqlFieldHandler
  extends GenericFieldHandler
  implements FieldHandlerInterface, FilterOperationHandlers
{
  // region filter comparisons
  override async innerFilterAllAnyOf(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    const { filter, knex, column } = rootArgs;

    // Condition for filter, without negation
    const condition = (builder: Knex.QueryBuilder) => {
      let items = val?.split(',');
      if (['enum', 'set'].includes(column.dt?.toLowerCase())) {
        items = items.map((item) => item.trimEnd());
      }
      for (let i = 0; i < items?.length; i++) {
        const bindings = [sourceField, `%,${items[i]},%`];
        const sql = "CONCAT(',', ??, ',') like ?";
        if (i === 0) {
          builder = builder.where(knex.raw(sql, bindings));
        } else {
          if (
            filter.comparison_op === 'allof' ||
            filter.comparison_op === 'nallof'
          ) {
            builder = builder.andWhere(knex.raw(sql, bindings));
          } else {
            builder = builder.orWhere(knex.raw(sql, bindings));
          }
        }
      }
    };

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        if (
          filter.comparison_op === 'allof' ||
          filter.comparison_op === 'anyof'
        ) {
          qb.where(condition);
        } else {
          qb.whereNot(condition).orWhereNull(sourceField as any);
        }
      },
    };
  }
  // endregion filter comparisons
}
