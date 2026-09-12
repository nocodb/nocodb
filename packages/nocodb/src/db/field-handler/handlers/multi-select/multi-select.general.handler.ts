import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type {
  FilterVerificationResult,
  SortOptions,
} from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { sanitize } from '~/helpers/sqlSanitize';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class MultiSelectGeneralHandler extends GenericFieldHandler {
  override async verifyFilter(_filter: Filter, _column: Column) {
    return {
      isValid: true,
    } as FilterVerificationResult;
  }

  /**
   * Single/MultiSelect ORDER BY in MySQL needs `CONCAT(col)` to coerce the
   * underlying `enum`/`set` type into a string — sorting on the native
   * `enum` orders by the declared option position, not the option label.
   * NocoDB stores options as strings; users expect alphabetical sort. Other
   * dialects sort the raw column name fine.
   */
  override async applySort(
    qb: Knex.QueryBuilder,
    column: Column,
    direction: 'asc' | 'desc',
    options: SortOptions,
  ): Promise<void> {
    const { alias, nulls } = options;
    const knex = options.knex as CustomKnex;
    const client = knex.clientType();
    const fieldName = alias
      ? `${alias}.${column.column_name}`
      : column.column_name;

    if (client === 'mysql' || client === 'mysql2') {
      qb.orderBy(
        sanitize(knex.raw('CONCAT(??)', [column.column_name])),
        direction,
        nulls,
      );
      return;
    }
    qb.orderBy(sanitize(fieldName), direction, nulls);
  }
}
