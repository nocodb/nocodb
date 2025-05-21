import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { HandlerOptions } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import { sanitize } from '~/helpers/sqlSanitize';
import { ncIsStringHasValue } from '~/db/field-handler/utils/handlerUtils';

export class JsonGeneralHandler extends GenericFieldHandler {
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
      const appendIsNull = () => {
        qb.where((nestedQb) => {
          nestedQb
            .whereNull(field)
            .orWhere(knex.raw("?? = '{}'", [field]))
            .orWhere(knex.raw("?? = '[]'", [field]));
        });
      };
      const appendIsNotNull = () => {
        qb.whereNotNull(field)
          .whereNot(knex.raw("?? = '{}'", [field]))
          .whereNot(knex.raw("?? = '[]'", [field]));
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
              qb.where(knex.raw('?? = ?', [field, jsonVal]));
            } else {
              qb.where(knex.raw('?? = ?', [field, jsonVal]));
            }
          }
          break;

        case 'neq':
        case 'not':
          if (!ncIsStringHasValue(val)) {
            qb.where((nestedQb) => {
              nestedQb.whereNotNull(field);
            });
          } else {
            const { jsonVal, isValidJson } = this.parseJsonValue(val);
            qb.where((nestedQb) => {
              if (isValidJson) {
                nestedQb.where(knex.raw('?? != ?', [field, jsonVal]));
              } else {
                nestedQb.where(knex.raw('?? != ?', [field, jsonVal]));
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
            qb.where(knex.raw('?? like ?', [field, val]));
          }
          break;

        case 'nlike':
          if (!ncIsStringHasValue(val)) {
            qb.whereNotNull(field);
          } else {
            val = `%${val}%`;
            qb.where((nestedQb) => {
              nestedQb.where(knex.raw('?? not like ?', [field, val]));
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
    };
  }

  protected parseJsonValue(val: any): {
    jsonVal: string;
    isValidJson: boolean;
  } {
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

  override async verifyFilter(filter: Filter, column: Column) {
    return super.verifyFilter(filter, column);
  }
}
