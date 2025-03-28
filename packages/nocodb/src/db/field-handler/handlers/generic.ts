import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FieldHandlerInterface,
  FilterVerificationResult,
  HandlerOptions,
} from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { getAs, getColumnName } from '~/helpers/dbHelpers';
import { ncIsStringHasValue } from '~/db/field-handler/utils/handlerUtils';
import { sanitize } from '~/helpers/sqlSanitize';

export class GenericFieldHandler implements FieldHandlerInterface {
  async select(
    qb: Knex.QueryBuilder,
    column: Column,
    options: HandlerOptions,
  ): Promise<void> {
    const { alias, context, baseModel, tnPath } = options;

    const columnName = await getColumnName(
      context,
      column,
      await baseModel.model.getColumns(context),
    );

    const tableName = alias || tnPath || '';
    const fullColumnName = tableName
      ? `${tableName}.${columnName}`
      : columnName;

    const selectAlias = sanitize(getAs(column) || columnName);
    const selectColumn = sanitize(fullColumnName);

    qb.select({ [selectAlias]: selectColumn });
  }

  async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: HandlerOptions,
  ) {
    const { alias } = options;
    const val = filter.value;
    const field = alias ? `${alias}.${column.column_name}` : column.column_name;

    return (qb: Knex.QueryBuilder) => {
      switch (filter.comparison_op) {
        case 'eq':
          if (!ncIsStringHasValue(val)) {
            qb.where((nestedQb) => {
              nestedQb.where(knex.raw("?? = ''", [field])).orWhereNull(field);
            });
          } else {
            qb.where(knex.raw('?? = ?', [field, val]));
          }
          break;

        case 'neq':
        case 'not':
          if (!ncIsStringHasValue(val)) {
            qb.where((nestedQb) => {
              nestedQb
                .where(knex.raw("?? != ''", [field]))
                .orWhereNotNull(field);
            });
          } else {
            qb.where((nestedQb) => {
              nestedQb
                .where(knex.raw('?? != ?', [field, val]))
                .orWhereNull(field);
            });
          }
          break;

        case 'like':
          if (!ncIsStringHasValue(val)) {
            qb.whereNull(field);
          } else {
            qb.where(knex.raw('??::text ilike ?', [field, `%${val}%`]));
          }
          break;

        case 'nlike':
          if (!ncIsStringHasValue(val)) {
            qb.whereNotNull(field);
          } else {
            qb.where((nestedQb) => {
              nestedQb.where(
                knex.raw('??::text not ilike ?', [field, `%${val}%`]),
              );
            });
          }
          break;

        case 'blank':
          qb.where((nestedQb) => {
            nestedQb.whereNull(field).orWhere(knex.raw("?? = ''", [field]));
          });
          break;

        case 'notblank':
          qb.where((nestedQb) => {
            nestedQb.whereNotNull(field).orWhere(knex.raw("?? != ''", [field]));
          });
          break;

        default:
          throw new Error(
            `Unsupported comparison operator for JSON: ${filter.comparison_op}`,
          );
      }
    };
  }

  async verifyFilter(
    _filter: Filter,
    _column: Column,
  ): Promise<FilterVerificationResult> {
    return {
      isValid: true,
    };
  }
}
