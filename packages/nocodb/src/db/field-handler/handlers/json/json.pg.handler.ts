import { JsonGeneralHandler } from './json.general.handler';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { HandlerOptions } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { sanitize } from '~/helpers/sqlSanitize';
import { ncIsStringHasValue } from '~/db/field-handler/utils/handlerUtils';

const appendIsNull = ({
  qb,
  field,
  knex,
}: {
  qb: Knex.QueryBuilder;
  knex: CustomKnex;
  field: string | any;
}) => {
  qb.where((nestedQb) => {
    nestedQb
      .where(knex.raw("??::jsonb = '{}'::jsonb", [field]))
      .orWhere(knex.raw("??::jsonb = '[]'::jsonb", [field]))
      .orWhere(knex.raw("??::text = ''", [field]))
      .orWhereNull(field);
  });
};
const appendIsNotNull = ({
  qb,
  field,
  knex,
}: {
  qb: Knex.QueryBuilder;
  knex: CustomKnex;
  field: string | any;
}) => {
  qb.where((nestedQb) => {
    nestedQb
      .whereNot(knex.raw("??::jsonb = '{}'::jsonb", [field]))
      .whereNot(knex.raw("??::jsonb = '[]'::jsonb", [field]))
      .whereNot(knex.raw("??::text = ''", [field]))
      .whereNotNull(field);
  });
};

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
          if (!ncIsStringHasValue(val)) {
            appendIsNull({ qb, field, knex });
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
          if (!ncIsStringHasValue(val)) {
            appendIsNotNull({ qb, field, knex });
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
          if (!ncIsStringHasValue(val)) {
            appendIsNull({ qb, knex, field });
          } else {
            val = `%${val}%`;
            qb.where(knex.raw('??::text ilike ?', [field, val]));
          }
          break;

        case 'nlike':
          if (!ncIsStringHasValue(val)) {
            appendIsNotNull({ qb, knex, field });
          } else {
            val = `%${val}%`;

            qb.where((nestedQb) => {
              nestedQb.where(knex.raw('??::text not ilike ?', [field, val]));
              nestedQb.orWhereNull(field);
            });
          }
          break;

        case 'blank':
          appendIsNull({ qb, knex, field });
          break;

        case 'notblank':
          appendIsNotNull({ qb, knex, field });
          break;

        default:
          throw new Error(
            `Unsupported comparison operator for JSON: ${filter.comparison_op}`,
          );
      }
    };
  }
}
