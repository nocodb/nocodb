import { ncIsNull, ncIsUndefined } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import { NC_MAX_TEXT_LENGTH } from 'src/constants';
import type { NcContext } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { FilterOptions } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import { sanitize } from '~/helpers/sqlSanitize';
import { ncIsStringHasValue } from '~/db/field-handler/utils/handlerUtils';

export class JsonGeneralHandler extends GenericFieldHandler {
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
            case 'null':
            case 'blank':
            case 'empty': {
              appendIsNull();
              break;
            }
            case 'notnull':
            case 'notblank':
            case 'notempty': {
              appendIsNotNull();
              break;
            }
          }
          break;

        case 'isnot':
          switch (val) {
            case 'null':
            case 'blank':
            case 'empty': {
              appendIsNotNull();
              break;
            }
            case 'notnull':
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

  override async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
    };
  }): Promise<{ value: any }> {
    if (ncIsUndefined(params.value) || ncIsNull(params.value)) {
      return { value: params.value };
    }
    const length =
      (typeof params.value === 'string' && params.value.length) ??
      (typeof params.value === 'object' && JSON.stringify(params.value).length);

    if (length > NC_MAX_TEXT_LENGTH) {
      NcError._.valueLengthExceedLimit({
        column: params.column.title,
        type: params.column.uidt,
        length,
        maxLength: NC_MAX_TEXT_LENGTH,
      });
    }
    const parseJsonResult = this.parseJsonValue(params.value);
    if (parseJsonResult.isValidJson) {
      return { value: parseJsonResult.jsonVal };
    } else {
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
      });
    }
  }
}
