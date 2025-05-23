import { type NcContext } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FieldHandlerInterface,
  FilterOperation,
  FilterOperationHandlers,
  FilterOptions,
  FilterVerificationResult,
} from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { ncIsStringHasValue } from '~/db/field-handler/utils/handlerUtils';
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
    const field = alias ? `${alias}.${column.column_name}` : column.column_name;

    return (qb: Knex.QueryBuilder) => {
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
        case 'blank':
          filterOperation = this.filterBlank;
          break;

        case 'notempty':
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

        default:
          throw new Error(
            `Unsupported comparison operator for ${column.uidt}: ${filter.comparison_op}`,
          );
      }

      filterOperation(
        {
          val,
          sourceField: field,
          qb,
        },
        {
          knex,
          filter,
          column,
        },
        options,
      );
    };
  }

  // region filter comparisons
  filterEq(
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
    _options: FilterOptions,
  ) {
    const { val, qb, sourceField } = args;
    const { knex } = rootArgs;

    if (!ncIsStringHasValue(val)) {
      qb.where((nestedQb) => {
        nestedQb.whereNull(sourceField as any);
      });
    } else {
      qb.where(knex.raw('?? = ?', [sourceField, val]));
    }
  }

  filterNeq(
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
    _options: FilterOptions,
  ) {
    const { val, qb, sourceField } = args;
    const { knex } = rootArgs;

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
  }

  filterNot(
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
    return this.filterNeq(args, rootArgs, options);
  }

  filterLike(
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
    _options: FilterOptions,
  ) {
    const { val, qb, sourceField } = args;
    const { knex } = rootArgs;

    if (!ncIsStringHasValue(val)) {
      qb.whereNull(sourceField as any);
    } else {
      qb.where(knex.raw('??::text ilike ?', [sourceField, `%${val}%`]));
    }
  }

  filterNlike(
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
    _options: FilterOptions,
  ) {
    const { val, qb, sourceField } = args;
    const { knex } = rootArgs;

    if (!ncIsStringHasValue(val)) {
      qb.whereNotNull(sourceField as any);
    } else {
      qb.where((nestedQb) => {
        nestedQb.where(
          knex.raw('??::text not ilike ?', [sourceField, `%${val}%`]),
        );
      });
    }
  }

  filterBlank(
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
    _options: FilterOptions,
  ) {
    const { qb, sourceField } = args;
    const { knex } = rootArgs;

    qb.where((nestedQb) => {
      nestedQb
        .whereNull(sourceField as any)
        .orWhere(knex.raw("?? = ''", [sourceField]));
    });
  }

  filterNotblank(
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
    _options: FilterOptions,
  ) {
    const { qb, sourceField } = args;
    const { knex } = rootArgs;

    qb.where((nestedQb) => {
      nestedQb
        .whereNotNull(sourceField as any)
        .orWhere(knex.raw("?? != ''", [sourceField]));
    });
  }

  filterIs(
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
        return this.filterBlank(args, rootArgs, options);
      }
      case 'notblank':
      case 'notempty': {
        return this.filterNotblank(args, rootArgs, options);
      }
    }
  }

  filterIsnot(
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

  filterGt(
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
    const { val, qb, sourceField } = args;
    qb.where(sourceField as any, '>', val);
  }

  filterGte(
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
    const { val, qb, sourceField } = args;
    qb.where(sourceField as any, '>=', val);
  }

  filterLt(
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
    const { val, qb, sourceField } = args;
    qb.where(sourceField as any, '<', val);
  }

  filterLte(
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
    const { val, qb, sourceField } = args;
    qb.where(sourceField as any, '<=', val);
  }

  filterAllof: FilterOperation;
  filterNallof: FilterOperation;
  filterAnyof: FilterOperation;
  filterNanyof: FilterOperation;

  // to be implemented on checkbox itself
  filterChecked(
    _args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
      qb: Knex.QueryBuilder;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    throw new Error(
      `Unsupported comparison operator for ${rootArgs.column.uidt}: ${rootArgs.filter.comparison_op}`,
    );
  }

  // to be implemented on checkbox itself
  filterNotchecked(
    _args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
      qb: Knex.QueryBuilder;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    throw new Error(
      `Unsupported comparison operator for ${rootArgs.column.uidt}: ${rootArgs.filter.comparison_op}`,
    );
  }
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
