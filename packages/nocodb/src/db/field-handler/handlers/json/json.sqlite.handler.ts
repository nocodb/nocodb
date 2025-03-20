import type { HandlerOptions } from '~/db/field-handler/field-handler.interface';
import type { Knex } from 'knex';
import type { Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import { sanitize } from '~/helpers/sqlSanitize';

export class JsonSqliteHandler extends GenericFieldHandler {
  async filter(
    qb: Knex.QueryBuilder,
    filter: Filter,
    column: Column,
    options: HandlerOptions,
  ): Promise<void> {
    const { alias } = options;
    const field = sanitize(
      alias ? `${alias}.${column.column_name}` : column.column_name,
    );
    let val = filter.value;

    switch (filter.comparison_op) {
      case 'eq':
        if (val === '') {
          qb.where((nestedQb) => {
            nestedQb.where(field, '{}').orWhere(field, '[]').orWhereNull(field);
          });
        } else {
          const { jsonVal } = this.parseJsonValue(val);
          qb.where(field, jsonVal);
        }
        break;

      case 'neq':
      case 'not':
        if (val === '') {
          qb.where((nestedQb) => {
            nestedQb
              .whereNot(field, '{}')
              .whereNot(field, '[]')
              .orWhereNull(field);
          });
        } else {
          const { jsonVal } = this.parseJsonValue(val);
          qb.where((nestedQb) => {
            nestedQb.whereNot(field, jsonVal).orWhereNull(field);
          });
        }
        break;

      case 'like':
        val = val ? `%${val}%` : val;
        if (!val) {
          qb.whereNotNull(field);
        } else {
          qb.where(field, 'like', val);
        }
        break;

      case 'nlike':
        val = val ? `%${val}%` : val;
        if (!val) {
          qb.whereNull(field);
        } else {
          qb.where((nestedQb) => {
            nestedQb.whereNot(field, 'like', val);
            if (val !== '%%') {
              nestedQb.orWhere(field, '').orWhereNull(field);
            } else {
              nestedQb.orWhereNull(field);
            }
          });
        }
        break;

      case 'blank':
        qb.where((nestedQb) => {
          nestedQb.whereNull(field).orWhere(field, '{}').orWhere(field, '[]');
        });
        break;

      case 'notblank':
        qb.whereNotNull(field).whereNot(field, '{}').whereNot(field, '[]');
        break;

      default:
        throw new Error(
          `Unsupported comparison operator for JSON: ${filter.comparison_op}`,
        );
    }
  }

  private parseJsonValue(val: any): { jsonVal: string } {
    let jsonVal = val;
    if (typeof val === 'object' && val !== null) {
      jsonVal = JSON.stringify(val);
    }
    return { jsonVal };
  }
}
