import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FieldHandlerInterface,
  FilterOperationHandlers,
  FilterOptions,
} from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { ncIsStringHasValue } from '~/db/field-handler/utils/handlerUtils';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class GenericMysqlFieldHandler
  extends GenericFieldHandler
  implements FieldHandlerInterface, FilterOperationHandlers
{
  // region filter comparisons
  override filterLike(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
      qb: Knex.QueryBuilder;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ): void {
    const { val, qb, sourceField } = args;
    const { knex } = rootArgs;

    if (!ncIsStringHasValue(val)) {
      qb.whereNull(sourceField as any);
    } else {
      qb.where(knex.raw('?? ilike ?', [sourceField, `%${val}%`]));
    }
  }

  filterNlike(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
      qb: Knex.QueryBuilder;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { val, qb, sourceField } = args;
    const { knex } = rootArgs;

    if (!ncIsStringHasValue(val)) {
      qb.whereNotNull(sourceField as any);
    } else {
      qb.where((nestedQb) => {
        nestedQb.where(knex.raw('?? not ilike ?', [sourceField, `%${val}%`]));
      });
    }
  }

  override innerFilterAllAnyOf(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
      qb: Knex.QueryBuilder;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    const { qb } = args;
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
    qb.where((subQb) => {
      if (
        filter.comparison_op === 'allof' ||
        filter.comparison_op === 'anyof'
      ) {
        subQb.where(condition);
      } else {
        subQb.whereNot(condition).orWhereNull(sourceField as any);
      }
    });
  }
  // endregion filter comparisons
}
