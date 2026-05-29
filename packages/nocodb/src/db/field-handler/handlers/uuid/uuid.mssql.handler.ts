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

/**
 * SQL Server UUID field handler.
 *
 * NocoDB stores UUIDs in `uniqueidentifier` columns (see `MssqlUi.ts` —
 * `case 'UUID'` maps to `uniqueidentifier` with `cdf=NEWID()`). The native
 * `uniqueidentifier` type:
 *
 *   - Compares case-insensitively to string literals shaped like a valid GUID,
 *     but raises "Conversion failed when converting from a character string
 *     to uniqueidentifier" on any partial value (e.g. `'abc'`, or a search
 *     prefix like `'1234'`). Filtering by a typo would error out instead of
 *     returning no rows.
 *   - Does NOT support `LIKE`/`ILIKE` against the raw column type — T-SQL
 *     rejects "Argument data type uniqueidentifier is invalid for argument 1
 *     of like function."
 *
 * Both issues vanish once the column is cast to `NVARCHAR(36)`, which is
 * exactly what the pg handler does with `::text`. We mirror that contract
 * so partial searches, IN, and ordering all behave identically.
 *
 * `NVARCHAR(36)` is enough for the canonical `xxxxxxxx-xxxx-...` shape that
 * `uniqueidentifier` always produces; no GUID variant uses braces in this
 * representation, so we don't need `NVARCHAR(MAX)`.
 */
export class UuidMssqlHandler
  extends GenericFieldHandler
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
          // NVARCHAR cast avoids "conversion failed" on non-GUID partial input
          // and falls back to a normal string equality (case-insensitive under
          // the default `_CI_AS` collation, matching pg's `::text =` behavior).
          qb.where(
            knex.raw('CAST(?? AS NVARCHAR(36)) = ?', [sourceField, val]),
          );
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
              .where(knex.raw("CAST(?? AS NVARCHAR(36)) <> ''", [sourceField]))
              .whereNotNull(sourceField as any);
          });
        } else {
          qb.where((nestedQb) => {
            nestedQb
              .where(
                knex.raw('CAST(?? AS NVARCHAR(36)) <> ?', [sourceField, val]),
              )
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
            .orWhere(knex.raw("CAST(?? AS NVARCHAR(36)) = ''", [sourceField]));
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
            .where(knex.raw("CAST(?? AS NVARCHAR(36)) <> ''", [sourceField]));
        });
      },
    };
  }

  // gt/gte/lt/lte: cast for the same reason — partial values fed to a raw
  // `uniqueidentifier` comparison would otherwise raise a conversion error
  // instead of returning the empty / full set the user expects.
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
        qb.where(knex.raw('CAST(?? AS NVARCHAR(36)) > ?', [sourceField, val]));
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
        qb.where(knex.raw('CAST(?? AS NVARCHAR(36)) >= ?', [sourceField, val]));
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
        qb.where(knex.raw('CAST(?? AS NVARCHAR(36)) < ?', [sourceField, val]));
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
        qb.where(knex.raw('CAST(?? AS NVARCHAR(36)) <= ?', [sourceField, val]));
      },
    };
  }

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
    const { sourceField } = args;
    let { val } = args;
    const { knex } = rootArgs;

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        if (!ncIsStringHasValue(val)) {
          qb.where((nestedQb) => {
            nestedQb
              .whereNull(sourceField as any)
              .orWhere(
                knex.raw("CAST(?? AS NVARCHAR(36)) = ''", [sourceField]),
              );
          });
        } else {
          val = val.startsWith('%') || val.endsWith('%') ? val : `%${val}%`;
          qb.where(
            knex.raw('CAST(?? AS NVARCHAR(36)) LIKE ?', [sourceField, val]),
          );
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
          qb.where((nestedQb) => {
            nestedQb
              .where(knex.raw("CAST(?? AS NVARCHAR(36)) <> ''", [sourceField]))
              .orWhereNull(sourceField as any);
          });
        } else {
          val = val.startsWith('%') || val.endsWith('%') ? val : `%${val}%`;
          // not-like includes NULL rows by convention (pg handler does the same)
          qb.where((nestedQb) => {
            nestedQb
              .whereNot(
                knex.raw('CAST(?? AS NVARCHAR(36)) LIKE ?', [sourceField, val]),
              )
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
        const placeholders = values.map(() => '?').join(', ');
        qb.where(
          knex.raw(`CAST(?? AS NVARCHAR(36)) IN (${placeholders})`, [
            sourceField,
            ...values,
          ]),
        );
      },
    };
  }
}
