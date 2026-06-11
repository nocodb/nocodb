import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type { SortOptions } from '~/db/field-handler/field-handler.interface';
import type { Column } from '~/models';
import { sanitize } from '~/helpers/sqlSanitize';
import { GenericMysqlFieldHandler } from '~/db/field-handler/handlers/generic.mysql';

/**
 * MySQL multi/single-select handler. Inherits the MySQL-flavored
 * `innerFilterAllAnyOf` (with `enum`/`set` trimEnd) from
 * `GenericMysqlFieldHandler` and adds the CONCAT-wrap on `applySort`.
 *
 * `CONCAT(col)` forces MySQL to sort by the option's text value rather than
 * its declared `enum` position — users expect alphabetical option order.
 */
export class MultiSelectMysqlHandler extends GenericMysqlFieldHandler {
  override async applySort(
    qb: Knex.QueryBuilder,
    column: Column,
    direction: 'asc' | 'desc',
    options: SortOptions,
  ): Promise<void> {
    const { nulls } = options;
    const knex = options.knex as CustomKnex;
    qb.orderBy(
      sanitize(knex.raw('CONCAT(??)', [column.column_name])),
      direction,
      nulls,
    );
  }
}
