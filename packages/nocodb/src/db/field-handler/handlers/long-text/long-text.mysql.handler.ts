import { LongTextGeneralHandler } from './long-text.general.handler';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type { FilterOptions } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { ncIsStringHasValue } from '~/db/field-handler/utils/handlerUtils';

/**
 * MySQL LongText handler — inherits the AI Prompt JSON-extract field
 * rewrite from `LongTextGeneralHandler` and overrides `filterEq` /
 * `filterNeq` to emit `BINARY ?? = ?` / `BINARY ?? != ?` for case-sensitive
 * comparison.
 *
 * Without `BINARY`, MySQL's default case-insensitive collation would match
 * `'ABC' = 'abc'` — the legacy switch in conditionV2 added this for all
 * string columns. Preserving it here keeps the behavior on parity for
 * routed LongText / AI Prompt columns.
 */
export class LongTextMysqlHandler extends LongTextGeneralHandler {
  override async filterEq(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    const { knex } = rootArgs;

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        if (!ncIsStringHasValue(val)) {
          // Match GenericFieldHandler.filterEq null-handling for empty/null
          // search values — no BINARY needed for IS NULL.
          qb.where((nestedQb) => {
            nestedQb.whereNull(sourceField as any);
          });
        } else {
          qb.where(knex.raw('BINARY ?? = ?', [sourceField, val]));
        }
      },
    };
  }

  override async filterNeq(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
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
              .where(knex.raw("?? != ''", [sourceField]))
              .whereNotNull(sourceField as any);
          });
        } else {
          // The legacy switch wrapped this with `orWhereNull` to include
          // rows where the column is NULL alongside the case-sensitive
          // mismatch — preserve that.
          qb.where((nestedQb) => {
            nestedQb
              .where(knex.raw('BINARY ?? != ?', [sourceField, val]))
              .orWhereNull(sourceField as any);
          });
        }
      },
    };
  }

  override async filterNot(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    options: FilterOptions,
  ) {
    return this.filterNeq(args, rootArgs, options);
  }
}
