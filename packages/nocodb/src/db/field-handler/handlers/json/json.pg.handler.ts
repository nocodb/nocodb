import type { HandlerOptions } from '~/db/field-handler/field-handler.interface';
import type { Knex } from 'knex';
import type { Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import { sanitize } from '~/helpers/sqlSanitize';

export class JsonPgHandler extends GenericFieldHandler {
  async filter(
    qb: Knex.QueryBuilder,
    filter: Filter,
    column: Column,
    options: HandlerOptions,
  ): Promise<void> {
    const { alias, knex } = options;
    const field = sanitize(
      alias ? `${alias}.${column.column_name}` : column.column_name,
    );
    let val = filter.value;

    switch (filter.comparison_op) {
      case 'eq':
        if (val === '') {
          qb.where((nestedQb) => {
            nestedQb
              .where(knex.raw("??::jsonb = '{}'::jsonb", [field]))
              .orWhere(knex.raw("??::jsonb = '[]'::jsonb", [field]))
              .orWhereNull(field);
          });
        } else {
          const { jsonVal, isValidJson } = this.parseJsonValue(val);
          if (isValidJson) {
            qb.where(knex.raw('??::jsonb = ?::jsonb', [field, jsonVal]));
          } else {
            qb.where(knex.raw('??::text = ?', [field, jsonVal]));
          }
        }
        break;

      case 'neq':
      case 'not':
        if (val === '') {
          qb.where((nestedQb) => {
            nestedQb
              .whereNot(knex.raw("??::jsonb = '{}'::jsonb", [field]))
              .whereNot(knex.raw("??::jsonb = '[]'::jsonb", [field]))
              .orWhereNull(field);
          });
        } else {
          const { jsonVal, isValidJson } = this.parseJsonValue(val);
          qb.where((nestedQb) => {
            if (isValidJson) {
              nestedQb.where(
                knex.raw('??::jsonb != ?::jsonb', [field, jsonVal]),
              );
            } else {
              nestedQb.where(knex.raw('??::text != ?', [field, jsonVal]));
            }
            nestedQb.orWhereNull(field);
          });
        }
        break;

      case 'like':
        val = val ? `%${val}%` : val;
        if (!val) {
          qb.whereNotNull(field);
        } else {
          qb.where(knex.raw('??::text ilike ?', [field, val]));
        }
        break;

      case 'nlike':
        val = val ? `%${val}%` : val;
        if (!val) {
          qb.whereNull(field);
        } else {
          qb.where((nestedQb) => {
            nestedQb.where(knex.raw('??::text not ilike ?', [field, val]));
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
          nestedQb
            .whereNull(field)
            .orWhere(knex.raw("??::jsonb = '{}'::jsonb", [field]))
            .orWhere(knex.raw("??::jsonb = '[]'::jsonb", [field]));
        });
        break;

      case 'notblank':
        qb.whereNotNull(field)
          .whereNot(knex.raw("??::jsonb = '{}'::jsonb", [field]))
          .whereNot(knex.raw("??::jsonb = '[]'::jsonb", [field]));
        break;

      default:
        throw new Error(
          `Unsupported comparison operator for JSON: ${filter.comparison_op}`,
        );
    }
  }

  private parseJsonValue(val: any): { jsonVal: string; isValidJson: boolean } {
    let jsonVal = val;
    let isValidJson = false;
    if (typeof val === 'object' && val !== null) {
      jsonVal = JSON.stringify(val);
      isValidJson = true;
    } else if (typeof val === 'string') {
      try {
        JSON.parse(val);
        jsonVal = val;
        isValidJson = true;
      } catch {
        jsonVal = val;
      }
    }
    return { jsonVal, isValidJson };
  }
}
