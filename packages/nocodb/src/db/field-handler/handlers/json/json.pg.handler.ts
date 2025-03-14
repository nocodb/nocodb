import { JsonGeneralHandler } from './json.general.handler';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { HandlerOptions } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { sanitize } from '~/helpers/sqlSanitize';

export class JsonPgHandler extends JsonGeneralHandler {
  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: HandlerOptions,
  ) {
    const { alias } = options;
    const field = sanitize(
      alias ? `${alias}.${column.column_name}` : column.column_name,
    );
    let val = filter.value;

    return (qb: Knex.QueryBuilder) => {
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
    };
  }
}
