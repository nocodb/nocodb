import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FieldHandlerInterface,
  FilterOperationHandlers,
  FilterOptions,
} from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import { ncIsStringHasValue } from '~/db/field-handler/utils/handlerUtils';

export class GenericPgFieldHandler
  extends GenericFieldHandler
  implements FieldHandlerInterface, FilterOperationHandlers
{
  // region filter comparisons
  filterLike(
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
      qb.where((subQb) => {
        subQb.where(sourceField as any, '');
        subQb.whereNull(sourceField as any);
      });
    } else {
      qb.where(knex.raw('??::text ilike ?', [sourceField, `%${val}%`]));
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
        nestedQb.where(
          knex.raw('??::text not ilike ?', [sourceField, `%${val}%`]),
        );
      });
    }
  }

  innerFilterAllAnyOf(
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
        const sql = "(',' || ??::text || ',') ilike ?";
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
