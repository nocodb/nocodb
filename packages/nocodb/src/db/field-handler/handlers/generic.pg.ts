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
  async filterLike(
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
    const { knex } = rootArgs;

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        if (!ncIsStringHasValue(val)) {
          qb.where((subQb) => {
            subQb.where(sourceField as any, '');
            subQb.whereNull(sourceField as any);
          });
        } else {
          qb.where(knex.raw('??::text ilike ?', [sourceField, `%${val}%`]));
        }
      },
    };
  }

  async filterNlike(
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
    const { sourceField } = args;
    let { val } = args;
    const { knex } = rootArgs;

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        if (!ncIsStringHasValue(val)) {
          // val is empty -> all values including NULL but empty strings
          qb.whereNot(sourceField as any, '');
          qb.orWhereNull(sourceField as any);
        } else {
          val = val.startsWith('%') || val.endsWith('%') ? val : `%${val}%`;

          qb.whereNot(knex.raw(`?? ilike ?`, [sourceField, val]));
          if (val !== '%%') {
            // if value is not empty, empty or null should be included
            qb.orWhere(sourceField as any, '');
            qb.orWhereNull(sourceField as any);
          } else {
            // if value is empty, then only null is included
            qb.orWhereNull(sourceField as any);
          }
        }
      },
    };
  }

  async innerFilterAllAnyOf(
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
