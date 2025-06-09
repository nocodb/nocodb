import { JsonGeneralHandler } from './json.general.handler';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { FilterOptions } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { ncIsStringHasValue } from '~/db/field-handler/utils/handlerUtils';
import { sanitize } from '~/helpers/sqlSanitize';

export class JsonMySqlHandler extends JsonGeneralHandler {
  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: FilterOptions,
  ) {
    const { alias } = options;
    const field = sanitize(
      alias ? `${alias}.${column.column_name}` : column.column_name,
    );
    let val = filter.value;

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        const appendIsNull = () => {
          qb.where((nestedQb) => {
            nestedQb
              .whereNull(field)
              .orWhere(knex.raw("JSON_UNQUOTE(??) = '{}'", [field]))
              .orWhere(knex.raw("JSON_UNQUOTE(??) = '[]'", [field]));
          });
        };
        const appendIsNotNull = () => {
          qb.whereNotNull(field)
            .whereNot(knex.raw("JSON_UNQUOTE(??) = '{}'", [field]))
            .whereNot(knex.raw("JSON_UNQUOTE(??) = '[]'", [field]));
        };
        switch (filter.comparison_op) {
          case 'eq':
            if (!ncIsStringHasValue(val)) {
              qb.where((nestedQb) => {
                nestedQb.whereNull(field);
              });
            } else {
              const { jsonVal, isValidJson } = this.parseJsonValue(val);
              if (isValidJson) {
                qb.where(knex.raw('JSON_UNQUOTE(??) = ?', [field, jsonVal]));
              } else {
                qb.where(knex.raw('JSON_UNQUOTE(??) = ?', [field, jsonVal]));
              }
            }
            break;

          case 'neq':
          case 'not':
            if (val === '') {
              qb.where((nestedQb) => {
                nestedQb.whereNotNull(field);
              });
            } else {
              const { jsonVal, isValidJson } = this.parseJsonValue(val);
              qb.where((nestedQb) => {
                if (isValidJson) {
                  nestedQb.where(
                    knex.raw('JSON_UNQUOTE(??) != ?', [field, jsonVal]),
                  );
                } else {
                  nestedQb.where(
                    knex.raw('JSON_UNQUOTE(??) != ?', [field, jsonVal]),
                  );
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
              qb.where(knex.raw('JSON_UNQUOTE(??) like ?', [field, val]));
            }
            break;

          case 'nlike':
            val = val ? `%${val}%` : val;
            if (!val) {
              qb.whereNull(field);
            } else {
              qb.where((nestedQb) => {
                nestedQb.where(
                  knex.raw('JSON_UNQUOTE(??) not like ?', [field, val]),
                );
                if (val !== '%%') {
                  nestedQb.orWhere(field, '').orWhereNull(field);
                } else {
                  nestedQb.orWhereNull(field);
                }
              });
            }
            break;

          case 'blank':
            appendIsNull();
            break;

          case 'notblank':
            appendIsNotNull();
            break;

          case 'is':
            switch (val) {
              case 'blank':
              case 'empty': {
                appendIsNull();
                break;
              }
              case 'notblank':
              case 'notempty': {
                appendIsNotNull();
                break;
              }
            }
            break;

          case 'isnot':
            switch (val) {
              case 'blank':
              case 'empty': {
                appendIsNotNull();
                break;
              }
              case 'notblank':
              case 'notempty': {
                appendIsNull();
                break;
              }
            }
            break;

          default:
            throw new Error(
              `Unsupported comparison operator for JSON: ${filter.comparison_op}`,
            );
        }
      },
    };
  }

  override async verifyFilter(filter: Filter, column: Column) {
    return super.verifyFilter(filter, column);
  }
}
