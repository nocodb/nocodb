import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FieldHandlerInterface,
  FilterOperationHandlers,
  FilterOptions,
} from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { GenericPgFieldHandler } from '~/db/field-handler/handlers/generic.pg';
import { ncIsStringHasValue } from '~/db/field-handler/utils/handlerUtils';

/**
 * PostgreSQL UUID field handler that casts UUID to text for all comparisons.
 * This allows filtering with partial text values without PostgreSQL throwing
 * "invalid input syntax for type uuid" errors.
 */
export class UuidPgHandler
  extends GenericPgFieldHandler
  implements FieldHandlerInterface, FilterOperationHandlers
{
  async filterEq(
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
          qb.where((nestedQb) => {
            nestedQb.whereNull(sourceField as any);
          });
        } else {
          qb.where(knex.raw('??::text = ?', [sourceField, val]));
        }
      },
    };
  }

  async filterNeq(
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
          qb.where((nestedQb) => {
            nestedQb
              .where(knex.raw("??::text != ''", [sourceField]))
              .whereNotNull(sourceField as any);
          });
        } else {
          qb.where((nestedQb) => {
            nestedQb
              .where(knex.raw('??::text != ?', [sourceField, val]))
              .orWhereNull(sourceField as any);
          });
        }
      },
    };
  }

  async filterBlank(
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
    const { knex } = rootArgs;

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          nestedQb
            .whereNull(sourceField as any)
            .orWhere(knex.raw("??::text = ''", [sourceField]));
        });
      },
    };
  }

  async filterNotblank(
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
    const { knex } = rootArgs;

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          nestedQb
            .whereNotNull(sourceField as any)
            .where(knex.raw("??::text != ''", [sourceField]));
        });
      },
    };
  }

  async filterGt(
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
        qb.where(knex.raw('??::text > ?', [sourceField, val]));
      },
    };
  }

  async filterGte(
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
        qb.where(knex.raw('??::text >= ?', [sourceField, val]));
      },
    };
  }

  async filterLt(
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
        qb.where(knex.raw('??::text < ?', [sourceField, val]));
      },
    };
  }

  async filterLte(
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
        qb.where(knex.raw('??::text <= ?', [sourceField, val]));
      },
    };
  }

  // Override parent filterNlike: the GenericPgFieldHandler version has an `orWhere(col != '')`
  // clause that is always true for non-empty UUID values, causing no rows to ever be filtered.
  // Fix: use a grouped WHERE so the OR only applies to NULL/empty rows, not all non-empty rows.
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
          // val is empty -> return all non-empty values and NULLs
          qb.where((nestedQb) => {
            nestedQb
              .whereNot(knex.raw(`??::text = ''`, [sourceField]))
              .orWhereNull(sourceField as any);
          });
        } else {
          val = val.startsWith('%') || val.endsWith('%') ? val : `%${val}%`;
          // "not like" should return rows that don't match, plus NULL rows
          qb.where((nestedQb) => {
            nestedQb
              .whereNot(knex.raw(`??::text ilike ?`, [sourceField, val]))
              .orWhereNull(sourceField as any);
          });
        }
      },
    };
  }

  async filterIn(
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
    const values = Array.isArray(val) ? val : val?.split?.(',');

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        // Build placeholders for each value
        const placeholders = values.map(() => '?').join(', ');
        qb.where(
          knex.raw(`??::text IN (${placeholders})`, [sourceField, ...values]),
        );
      },
    };
  }
}
