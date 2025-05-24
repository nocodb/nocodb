import { type NcContext } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { MetaService } from '~/meta/meta.service';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FieldHandlerInterface,
  FilterOperation,
  FilterOperationHandlers,
  FilterOptions,
  FilterVerificationResult,
} from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import {
  ncIsStringHasValue,
  unsupportedFilter,
} from '~/db/field-handler/utils/handlerUtils';
import { getAs, getColumnName } from '~/helpers/dbHelpers';
import { sanitize } from '~/helpers/sqlSanitize';

export class GenericFieldHandler
  implements FieldHandlerInterface, FilterOperationHandlers
{
  async select(
    qb: Knex.QueryBuilder,
    column: Column,
    options: FilterOptions,
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
    options: FilterOptions,
  ) {
    const { alias } = options;
    const val = filter.value;
    const field =
      options.customWhereClause ??
      (alias ? `${alias}.${column.column_name}` : column.column_name);
    return await this.handleFilter(
      { val, sourceField: field },
      { knex, filter, column },
      options,
    );
  }

  async handleFilter(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    options: FilterOptions,
  ) {
    const { sourceField, val } = args;
    const { filter } = rootArgs;
    let filterOperation: FilterOperation;
    switch (filter.comparison_op) {
      case 'eq':
        filterOperation = this.filterEq;
        break;

      case 'neq':
        filterOperation = this.filterNeq;
        break;

      case 'not':
        filterOperation = this.filterNot;
        break;

      case 'like':
        filterOperation = this.filterLike;
        break;

      case 'nlike':
        filterOperation = this.filterNlike;
        break;

      case 'empty':
      case 'null':
      case 'blank':
        filterOperation = this.filterBlank;
        break;

      case 'notempty':
      case 'notnull':
      case 'notblank':
        filterOperation = this.filterNotblank;
        break;

      case 'is':
        filterOperation = this.filterIs;
        break;

      case 'isnot':
        filterOperation = this.filterIsnot;
        break;

      case 'gt':
        filterOperation = this.filterGt;
        break;

      case 'ge':
      case 'gte':
        filterOperation = this.filterGte;
        break;

      case 'lt':
        filterOperation = this.filterLt;
        break;

      case 'le':
      case 'lte':
        filterOperation = this.filterLte;
        break;

      case 'in':
        filterOperation = this.filterIn;
        break;
      case 'allof':
        filterOperation = this.filterAllof;
        break;
      case 'nallof':
        filterOperation = this.filterNallof;
        break;
      case 'anyof':
        filterOperation = this.filterAnyof;
        break;
      case 'nanyof':
        filterOperation = this.filterNanyof;
        break;

      default:
        filterOperation = unsupportedFilter;
    }

    // to keep `this` reference
    return await filterOperation.bind(this)(
      {
        val,
        sourceField,
      },
      rootArgs,
      options,
    );
  }

  // region filter comparisons
  async filterEq(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    const { knex } = rootArgs;

    return (qb: Knex.QueryBuilder) => {
      if (!ncIsStringHasValue(val)) {
        qb.where((nestedQb) => {
          nestedQb.whereNull(sourceField as any);
        });
      } else {
        qb.where(knex.raw('?? = ?', [sourceField, val]));
      }
    };
  }

  async filterNeq(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    const { knex } = rootArgs;

    return (qb: Knex.QueryBuilder) => {
      if (!ncIsStringHasValue(val)) {
        qb.where((nestedQb) => {
          nestedQb
            .where(knex.raw("?? != ''", [sourceField]))
            .orWhereNotNull(sourceField as any);
        });
      } else {
        qb.where((nestedQb) => {
          nestedQb
            .where(knex.raw('?? != ?', [sourceField, val]))
            .orWhereNull(sourceField as any);
        });
      }
    };
  }

  async filterNot(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    options: FilterOptions,
  ) {
    return this.filterNeq(args, rootArgs, options);
  }

  async filterLike(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    const { knex } = rootArgs;

    return (qb: Knex.QueryBuilder) => {
      if (!ncIsStringHasValue(val)) {
        qb.where((subQb) => {
          subQb.where(sourceField as any, '');
          subQb.whereNull(sourceField as any);
        });
      } else {
        qb.where(knex.raw('?? like ?', [sourceField, `%${val}%`]));
      }
    };
  }

  async filterNlike(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { sourceField } = args;
    let { val } = args;
    const { knex } = rootArgs;

    return (qb: Knex.QueryBuilder) => {
      if (!ncIsStringHasValue(val)) {
        // val is empty -> all values including NULL but empty strings
        qb.whereNot(sourceField as any, '');
        qb.orWhereNull(sourceField as any);
      } else {
        val = val.startsWith('%') || val.endsWith('%') ? val : `%${val}%`;

        qb.whereNot(knex.raw(`?? like ?`, [sourceField, val]));
        if (val !== '%%') {
          // if value is not empty, empty or null should be included
          qb.orWhere(sourceField as any, '');
          qb.orWhereNull(sourceField as any);
        } else {
          // if value is empty, then only null is included
          qb.orWhereNull(sourceField as any);
        }
      }
    };
  }

  async filterBlank(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { sourceField } = args;
    const { knex } = rootArgs;

    return (qb: Knex.QueryBuilder) => {
      qb.where((nestedQb) => {
        nestedQb
          .whereNull(sourceField as any)
          .orWhere(knex.raw("?? = ''", [sourceField]));
      });
    };
  }

  async filterNotblank(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { sourceField } = args;
    const { knex } = rootArgs;
    return (qb: Knex.QueryBuilder) => {
      qb.where((nestedQb) => {
        nestedQb
          .whereNotNull(sourceField as any)
          .orWhere(knex.raw("?? != ''", [sourceField]));
      });
    };
  }

  async filterIs(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    options: FilterOptions,
  ) {
    const { val } = args;

    switch (val) {
      case 'blank':
      case 'empty': {
        return this.filterBlank(args, rootArgs, options);
      }
      case 'notblank':
      case 'notempty': {
        return this.filterNotblank(args, rootArgs, options);
      }
    }
  }

  async filterIsnot(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
      qb: Knex.QueryBuilder;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    options: FilterOptions,
  ) {
    const { val } = args;

    switch (val) {
      case 'blank':
      case 'empty': {
        return this.filterNotblank(args, rootArgs, options);
      }
      case 'notblank':
      case 'notempty': {
        return this.filterBlank(args, rootArgs, options);
      }
    }
  }

  async filterGt(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
      qb: Knex.QueryBuilder;
    },
    _rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    return (qb: Knex.QueryBuilder) => {
      qb.where(sourceField as any, '>', val);
    };
  }

  async filterGte(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    _rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    return (qb: Knex.QueryBuilder) => {
      qb.where(sourceField as any, '>=', val);
    };
  }

  async filterLt(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    _rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    return (qb: Knex.QueryBuilder) => {
      qb.where(sourceField as any, '<', val);
    };
  }

  async filterLte(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    _rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    return (qb: Knex.QueryBuilder) => {
      qb.where(sourceField as any, '<=', val);
    };
  }

  async innerFilterAllAnyOf(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    const { filter, knex } = rootArgs;

    // Condition for filter, without negation
    const condition = (builder: Knex.QueryBuilder) => {
      const items = val?.split(',');
      for (let i = 0; i < items?.length; i++) {
        const bindings = [sourceField, `%,${items[i]},%`];
        const sql = "CONCAT(',', ??, ',') like ?";
        if (i === 0) {
          builder = builder.where(knex.raw(sql, bindings));
        } else {
          if (
            filter.comparison_op === 'allof' ||
            filter.comparison_op === 'nallof'
          ) {
            builder = builder.andWhere(knex.raw(sql, bindings));
          } else {
            builder = builder.orWhere(knex.raw(sql, bindings));
          }
        }
      }
    };
    return (qb: Knex.QueryBuilder) => {
      qb.where((subQb) => {
        if (
          filter.comparison_op === 'allof' ||
          filter.comparison_op === 'anyof'
        ) {
          subQb.where(condition);
        } else {
          subQb.whereNot(condition).orWhereNull(sourceField as any);
        }
      });
    };
  }

  async filterAllof(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    options: FilterOptions,
  ) {
    return this.innerFilterAllAnyOf(args, rootArgs, options);
  }

  async filterNallof(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    options: FilterOptions,
  ) {
    return this.innerFilterAllAnyOf(args, rootArgs, options);
  }

  async filterAnyof(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    options: FilterOptions,
  ) {
    return this.innerFilterAllAnyOf(args, rootArgs, options);
  }
  async filterNanyof(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    options: FilterOptions,
  ) {
    return this.innerFilterAllAnyOf(args, rootArgs, options);
  }

  async filterIn(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    _rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    return (qb: Knex.QueryBuilder) => {
      qb.whereIn(
        sourceField as any,
        Array.isArray(val) ? val : val?.split?.(','),
      );
    };
  }

  // to be implemented on checkbox itself
  filterChecked = unsupportedFilter;

  // to be implemented on checkbox itself
  filterNotchecked = unsupportedFilter;
  // endregion filter comparisons

  async verifyFilter(
    _filter: Filter,
    _column: Column,
  ): Promise<FilterVerificationResult> {
    return {
      isValid: true,
    };
  }

  async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
    };
  }): Promise<{ value: any }> {
    return { value: params.value };
  }
  async parseDbValue(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
      logger?: Logger;
    };
  }): Promise<{ value: any }> {
    return { value: params.value };
  }
}
