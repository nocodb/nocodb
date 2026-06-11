import { type NcContext, isNumericCol, UITypes } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { MetaService } from '~/meta/meta.service';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FieldHandlerInterface,
  FilterOperation,
  FilterOperationHandlers,
  FilterOperationResult,
  FilterOptions,
  FilterVerificationResult,
  SortOptions,
} from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import {
  ncIsStringHasValue,
  unsupportedFilter,
} from '~/db/field-handler/utils/handlerUtils';
import { getAs, getColumnName } from '~/helpers/dbHelpers';
import { sanitize } from '~/helpers/sqlSanitize';

// Empty-string comparisons (`= ''` / `!= ''`) only make sense for text-like
// columns. Numeric / date / time columns can't be compared to '' — PG raises a
// cast error — so `blank`/`notblank` reduce to IS NULL / IS NOT NULL for them.
// Mirrors the type gate the legacy conditionV2 switch used.
const isEmptyStringIncompatible = (uidt: UITypes): boolean =>
  isNumericCol(uidt) ||
  [
    UITypes.Date,
    UITypes.DateTime,
    UITypes.CreatedTime,
    UITypes.LastModifiedTime,
    UITypes.Time,
    UITypes.Checkbox,
  ].includes(uidt);

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

  /**
   * Default ORDER BY: plain column name, optionally alias-qualified. Per-type
   * overrides on subclasses handle Rollup/Formula/Lookup/User/etc. The MSSQL
   * `text`/`ntext`/`image`/`xml` cast lives in the sortV2 orchestrator since
   * it's keyed on `column.dt`, not `column.uidt`.
   */
  async applySort(
    qb: Knex.QueryBuilder,
    column: Column,
    direction: 'asc' | 'desc',
    options: SortOptions,
  ): Promise<void> {
    const { alias, nulls } = options;
    const field = alias ? `${alias}.${column.column_name}` : column.column_name;
    qb.orderBy(sanitize(field), direction, nulls);
  }

  async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: FilterOptions,
  ): Promise<FilterOperationResult> {
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
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    options: FilterOptions,
  ): Promise<FilterOperationResult> {
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

      case 'null':
        filterOperation = this.filterNull;
        break;

      case 'notnull':
        filterOperation = this.filterNotnull;
        break;

      case 'empty':
        filterOperation = this.filterEmpty;
        break;

      case 'notempty':
        filterOperation = this.filterNotempty;
        break;

      case 'blank':
        filterOperation = this.filterBlank;
        break;

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

      case 'btw':
        filterOperation = this.filterBtw;
        break;
      case 'nbtw':
        filterOperation = this.filterNbtw;
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

      case 'checked':
        filterOperation = this.filterChecked;
        break;
      case 'notchecked':
        filterOperation = this.filterNotchecked;
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
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        if (!ncIsStringHasValue(val)) {
          qb.where((nestedQb) => {
            nestedQb.whereNull(sourceField as any);
          });
        } else {
          qb.where(knex.raw('?? = ?', [sourceField, val]));
        }
      },
    };
  }

  async filterNeq(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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
    const { knex, column } = rootArgs;
    // Native PG enum cells can't be '' — `IS NOT NULL` already covers
    // "any non-empty value"; the explicit `!= ''` check would error.
    const isNativePgEnum = !!column?.internal_meta?.pg_enum_type_name;

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        if (!ncIsStringHasValue(val)) {
          qb.where((nestedQb) => {
            if (isNativePgEnum) {
              nestedQb.whereNotNull(sourceField as any);
            } else {
              nestedQb
                .where(knex.raw("?? != ''", [sourceField]))
                .whereNotNull(sourceField as any);
            }
          });
        } else {
          qb.where((nestedQb) => {
            nestedQb
              .where(knex.raw('?? != ?', [sourceField, val]))
              .orWhereNull(sourceField as any);
          });
        }
      },
    };
  }

  async filterNot(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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
    const { knex, column } = rootArgs;
    const isNativePgEnum = !!column?.internal_meta?.pg_enum_type_name;

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        if (!ncIsStringHasValue(val)) {
          qb.where((subQb) => {
            if (!isNativePgEnum) subQb.where(sourceField as any, '');
            subQb.whereNull(sourceField as any);
          });
        } else {
          qb.where(knex.raw('?? like ?', [sourceField, `%${val}%`]));
        }
      },
    };
  }

  async filterNlike(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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
    const { knex, column } = rootArgs;
    const isNativePgEnum = !!column?.internal_meta?.pg_enum_type_name;

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        if (!ncIsStringHasValue(val)) {
          // val is empty -> all values including NULL but empty strings.
          // Native PG enums can't hold '', so every row qualifies — emit an
          // explicit no-op to keep the subquery group syntactically valid.
          if (isNativePgEnum) {
            qb.whereRaw('TRUE');
          } else {
            qb.whereNot(sourceField as any, '');
            qb.orWhereNull(sourceField as any);
          }
        } else {
          val = val.startsWith('%') || val.endsWith('%') ? val : `%${val}%`;

          qb.whereNot(knex.raw(`?? like ?`, [sourceField, val]));
          if (val !== '%%') {
            // if value is not empty, empty or null should be included
            if (!isNativePgEnum) qb.orWhere(sourceField as any, '');
            qb.orWhereNull(sourceField as any);
          } else {
            // if value is empty, then only null is included
            qb.orWhereNull(sourceField as any);
          }
        }
      },
    };
  }

  async filterBlank(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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
    const { knex, column } = rootArgs;
    const isNativePgEnum = !!column?.internal_meta?.pg_enum_type_name;
    // Legacy conditionV2 only added the `= ''` check for text-like columns.
    // Numeric / date / time columns can't be compared to '' (PG raises a cast
    // error), so for them `blank` is `IS NULL` only.
    const skipEmptyStringCompare = isEmptyStringIncompatible(column.uidt);

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          nestedQb.whereNull(sourceField as any);
          if (!isNativePgEnum && !skipEmptyStringCompare) {
            nestedQb.orWhere(knex.raw("?? = ''", [sourceField]));
          }
        });
      },
    };
  }

  /**
   * `null` op — strict `IS NULL`. Matches the legacy conditionV2 behavior
   * preserved for SingleLineText/Email/Phone/URL. Empty strings are NOT
   * included (that's `blank`). Column-type-specific blank logic (Attachment
   * `[]`, JSON `{}`, Formula text-cast) does NOT apply here — `null` was
   * always plain `whereNull` regardless of column type.
   */
  async filterNull(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    _rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { sourceField } = args;
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.whereNull(sourceField as any);
      },
    };
  }

  /**
   * `notnull` op — strict `IS NOT NULL`. Empty strings are included.
   * Counterpart of `filterNull`; see that method's docstring.
   */
  async filterNotnull(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    _rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { sourceField } = args;
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.whereNotNull(sourceField as any);
      },
    };
  }

  /**
   * `empty` op — strict `= ''`. NULLs are NOT included (that's `blank`).
   * The legacy conditionV2 path emits `qb.where(field, '')` for every
   * column type unconditionally; we replicate that here. If a numeric or
   * date column is filtered with `empty`, the resulting SQL will surface
   * the same dialect-level type error it did before the refactor.
   */
  async filterEmpty(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    _rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { sourceField } = args;
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where(sourceField as any, '');
      },
    };
  }

  /**
   * `notempty` op — `<> ''` OR `IS NULL`. NULLs are included; only the
   * empty string is excluded.
   */
  async filterNotempty(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    _rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { sourceField } = args;
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          nestedQb.whereNot(sourceField as any, '');
          nestedQb.orWhereNull(sourceField as any);
        });
      },
    };
  }

  async filterNotblank(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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
    const { knex, column } = rootArgs;
    const isNativePgEnum = !!column?.internal_meta?.pg_enum_type_name;
    // Legacy conditionV2 used `whereNotNull().whereNot(field, '')` — an AND, and
    // the `!= ''` was only added for text-like columns. The migration changed it
    // to `orWhere` (which wrongly includes empty strings, since '' IS NOT NULL)
    // and dropped the type gate (so numeric/date/time hit a '' cast error).
    const skipEmptyStringCompare = isEmptyStringIncompatible(column.uidt);

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          nestedQb.whereNotNull(sourceField as any);
          if (!isNativePgEnum && !skipEmptyStringCompare) {
            nestedQb.andWhere(knex.raw("?? != ''", [sourceField]));
          }
        });
      },
    };
  }

  async filterIs(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    options: FilterOptions,
  ) {
    const { val, sourceField } = args;

    // Legacy conditionV2 differentiated `is/empty` (= '' only) from
    // `is/blank` (= '' OR IS NULL). Route to the corresponding handler so
    // each sub-value keeps its strict meaning.
    switch (val) {
      case 'blank':
        return this.filterBlank(args, rootArgs, options);
      case 'empty':
        return this.filterEmpty(args, rootArgs, options);
      case 'notblank':
        return this.filterNotblank(args, rootArgs, options);
      case 'notempty':
        return this.filterNotempty(args, rootArgs, options);
      // `null`/`notnull` are strict SQL NULL checks — unlike `blank`/`empty`
      // they do not also match the empty string.
      case 'null':
        return {
          rootApply: undefined,
          clause: (qb: Knex.QueryBuilder) => {
            qb.whereNull(sourceField as any);
          },
        };
      case 'notnull':
        return {
          rootApply: undefined,
          clause: (qb: Knex.QueryBuilder) => {
            qb.whereNotNull(sourceField as any);
          },
        };
    }
  }

  async filterIsnot(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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
    const { val, sourceField } = args;

    // Each `isnot/X` is the complement of `is/X` (see filterIs above).
    switch (val) {
      case 'blank':
        return this.filterNotblank(args, rootArgs, options);
      case 'empty':
        return this.filterNotempty(args, rootArgs, options);
      case 'notblank':
        return this.filterBlank(args, rootArgs, options);
      case 'notempty':
        return this.filterEmpty(args, rootArgs, options);
      // `null`/`notnull` are strict SQL NULL checks — unlike `blank`/`empty`
      // they do not also match the empty string.
      case 'null':
        return {
          rootApply: undefined,
          clause: (qb: Knex.QueryBuilder) => {
            qb.whereNotNull(sourceField as any);
          },
        };
      case 'notnull':
        return {
          rootApply: undefined,
          clause: (qb: Knex.QueryBuilder) => {
            qb.whereNull(sourceField as any);
          },
        };
    }
  }

  async filterGt(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where(sourceField as any, '>', val);
      },
    };
  }

  async filterGte(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where(sourceField as any, '>=', val);
      },
    };
  }

  async filterLt(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where(sourceField as any, '<', val);
      },
    };
  }

  async filterLte(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where(sourceField as any, '<=', val);
      },
    };
  }

  // `btw` / `nbtw` — value is "lower,upper". Mirrors the legacy conditionV2
  // `whereBetween` / `whereNotBetween` (both exclude NULL rows, matching SQL
  // BETWEEN semantics). The generic switch previously had no case for these,
  // so they fell through to unsupportedFilter after the migration.
  async filterBtw(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ) {
    const { sourceField } = args;
    const [lower, upper] = String(rootArgs.filter.value ?? '').split(',');
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.whereBetween(sourceField as any, [lower, upper]);
      },
    };
  }

  async filterNbtw(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ) {
    const { sourceField } = args;
    const [lower, upper] = String(rootArgs.filter.value ?? '').split(',');
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.whereNotBetween(sourceField as any, [lower, upper]);
      },
    };
  }

  async innerFilterAllAnyOf(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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
        const bindings = [
          sourceField,
          `%,${items[i]},%`,
          sourceField,
          `%, ${items[i]},%`,
        ];
        const sql =
          "(CONCAT(',', ??, ',') like ? OR CONCAT(',', ??, ',') like ?)";
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

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
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
      },
    };
  }

  async filterAllof(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
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

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.whereIn(
          sourceField as any,
          Array.isArray(val) ? val : val?.split?.(','),
        );
      },
    };
  }

  async filterChecked(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    options: FilterOptions,
  ): Promise<FilterOperationResult> {
    return unsupportedFilter(args, rootArgs, options) as any;
  }

  async filterNotchecked(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    options: FilterOptions,
  ): Promise<FilterOperationResult> {
    return unsupportedFilter(args, rootArgs, options) as any;
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
