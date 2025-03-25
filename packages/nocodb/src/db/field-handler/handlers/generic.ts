import type { Knex } from 'knex';
import type {
  FieldHandlerInterface,
  HandlerOptions,
} from '~/db/field-handler/field-handler.interface';
import type { Column, Filter, Sort } from '~/models';
import { sanitize } from '~/helpers/sqlSanitize';
import { getColumnName } from '~/db/BaseModelSqlv2';
import { getAs } from '~/db/field-handler/utils/handlerUtils';

export abstract class GenericFieldHandler implements FieldHandlerInterface {
  async select(
    qb: Knex.QueryBuilder,
    column: Column,
    options: HandlerOptions,
  ): Promise<void> {
    const { alias, context, columns, tnPath } = options;

    const columnName = await getColumnName(
      context,
      column,
      columns || (await (await column.getModel(context)).getColumns(context)),
    );

    const tableName = alias || tnPath || '';
    const fullColumnName = tableName
      ? `${tableName}.${columnName}`
      : columnName;

    const selectAlias = sanitize(getAs(column) || columnName);
    const selectColumn = sanitize(fullColumnName);

    qb.select({ [selectAlias]: selectColumn });
  }

  async sort(
    _qb: Knex.QueryBuilder,
    _sort: Sort,
    _column: Column,
    _options: HandlerOptions,
  ) {
    // not implemented
  }

  async filter(
    _qb: Knex.QueryBuilder,
    _filter: Filter,
    _column: Column,
    _options: HandlerOptions,
  ) {
    // not implemented
  }
}
