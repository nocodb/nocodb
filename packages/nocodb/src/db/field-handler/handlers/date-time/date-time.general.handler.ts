import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc.js';
import {
  getNodejsTimezone,
  isDateTimeStringHasTimezone,
  parseDateTimeValue,
  parseProp,
} from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { MetaService } from '~/meta/meta.service';
import type {
  FilterOperationResult,
  FilterOptions,
  FilterVerificationResult,
} from '~/db/field-handler/field-handler.interface';
import type { Filter } from '~/models';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type { Column } from '~/models';
import { NcError } from '~/helpers/catchError';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

dayjs.extend(utc);
dayjs.extend(timezone);

export class DateTimeGeneralHandler extends GenericFieldHandler {
  dateValueFormat = 'YYYY-MM-DD HH:mm:ss';

  override async verifyFilter(filter: Filter, column: Column) {
    const supportedOperations = [
      'gb_eq',
      'gb_null',
      'eq',
      'neq',
      'not',
      'empty',
      'notempty',
      'null',
      'notnull',
      'blank',
      'notblank',
      'gt',
      'lt',
      'gte',
      'lte',
      'ge',
      'le',
      'isnot',
      'is',
      'isWithin',
    ];
    if (!supportedOperations.includes(filter.comparison_op)) {
      return {
        isValid: false,
        errors: [
          `Operation ${filter.comparison_op} is not supported for type ${column.uidt} on column ${column.title}`,
        ],
      } as FilterVerificationResult;
    }
    if (filter.comparison_sub_op === 'exactDate' || !filter.comparison_sub_op) {
      // check if value is not null or empty
      if (
        !(
          filter.value === null ||
          typeof filter.value === 'undefined' ||
          filter.value === '' ||
          (filter.comparison_op === 'in' && Array.isArray(filter.value))
        )
      ) {
        const dateTimeValue = await parseDateTimeValue(filter.value, {
          col: column,
        });
        if (dateTimeValue === null || typeof dateTimeValue === 'undefined') {
          return {
            isValid: false,
            errors: [
              `Value ${filter.value} is not supported for type ${column.uidt} on column ${column.title}`,
            ],
          } as FilterVerificationResult;
        }
      }
    }
    return {
      isValid: true,
    } as FilterVerificationResult;
  }

  protected parseDateTime(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
    };
  }) {
    // Allow null/undefined/empty values
    if (
      params.value === null ||
      params.value === undefined ||
      params.value === ''
    ) {
      return { value: null };
    }

    let dayjsUtcValue: dayjs.Dayjs;
    if (
      params.value instanceof Date ||
      typeof params.value === 'string' ||
      typeof params.value === 'number'
    ) {
      if (params.value instanceof Date) {
        dayjsUtcValue = dayjs(params.value).utc();
      } else if (typeof params.value === 'string') {
        let strVal: any = params.value;
        if (
          strVal.indexOf('-') < 0 &&
          strVal.indexOf('+') < 0 &&
          strVal.slice(-1) !== 'Z'
        ) {
          // if no timezone is given,
          // then append +00:00 to make it as UTC
          strVal += '+00:00';
        }
        dayjsUtcValue = dayjs(strVal).utc();
        if (!dayjsUtcValue.isValid() && params.column.meta?.date_format) {
          dayjsUtcValue = dayjs(strVal, params.column.meta?.date_format).utc();
        }
      } else if (typeof params.value === 'number') {
        dayjsUtcValue = dayjs.unix(params.value).utc();
      }
    }
    if (!dayjsUtcValue || !dayjsUtcValue.isValid()) {
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
      });
    }
    return { value: dayjsUtcValue };
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
    return {
      value: this.parseDateTime(params).value.format('YYYY-MM-DD HH:mm:ssZ'),
    };
  }

  protected getTimezone(
    _knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: FilterOptions,
  ) {
    const { context } = options;

    return getNodejsTimezone(
      parseProp(filter.meta).timezone,
      parseProp(column.meta).timezone,
      context.timezone,
    );
  }

  protected parseFilterValue(
    value: string,
    _knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: FilterOptions,
  ) {
    // if the time provided has timezone, return as is
    if (isDateTimeStringHasTimezone(value)) {
      return dayjs(value).tz(this.getTimezone(_knex, filter, column, options));
    }
    // assume local
    else {
      return dayjs.tz(value, this.getTimezone(_knex, filter, column, options));
    }
  }

  protected getNow(
    _knex: CustomKnex,
    filter: Filter & { groupby?: boolean },
    column: Column,
    options: FilterOptions,
  ) {
    const now = dayjs.tz(
      new Date(),
      this.getTimezone(_knex, filter, column, options),
    );
    if (filter.groupby) {
      return now.startOf('minute');
    }
    // the val will be start of day in timezone
    return now.startOf('day');
  }

  protected comparisonBetween(
    {
      sourceField,
      anchorDate,
      rangeDate,
      qb,
    }: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
      anchorDate: dayjs.Dayjs;
      rangeDate: dayjs.Dayjs;
      qb: Knex.QueryBuilder;
    },
    { knex }: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ) {
    qb.where(
      knex.raw('?? between ? and ?', [
        sourceField,
        anchorDate.utc().format(this.dateValueFormat),
        rangeDate.utc().format(this.dateValueFormat),
      ]),
    );
  }

  protected comparisonOp(
    {
      sourceField,
      val,
      qb,
      comparisonOp,
    }: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: dayjs.Dayjs;
      qb: Knex.QueryBuilder;
      comparisonOp: '<' | '<=' | '>' | '>=';
    },
    { knex }: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ) {
    qb.where(
      knex.raw(`?? ${comparisonOp} ?`, [
        sourceField,
        val.utc().format(this.dateValueFormat),
      ]),
    );
  }

  override async filter(
    knex: CustomKnex,
    filter: Filter & { groupby?: boolean },
    column: Column,
    options: FilterOptions,
  ) {
    const { alias } = options;
    const field =
      options.customWhereClause ??
      (alias ? `${alias}.${column.column_name}` : column.column_name);

    const now = this.getNow(knex, filter, column, options);
    let anchorDate: dayjs.Dayjs;
    const emptyResult = { clause: () => {} } as FilterOperationResult;

    // handle sub operation
    switch (filter.comparison_sub_op) {
      case 'today':
        anchorDate = now;
        break;
      case 'tomorrow':
        anchorDate = now.add(1, 'day');
        break;
      case 'yesterday':
        anchorDate = now.add(-1, 'day');
        break;
      case 'oneWeekAgo':
        anchorDate = now.add(-1, 'week');
        break;
      case 'oneWeekFromNow':
        anchorDate = now.add(1, 'week');
        break;
      case 'oneMonthAgo':
        anchorDate = now.add(-1, 'month');
        break;
      case 'oneMonthFromNow':
        anchorDate = now.add(1, 'month');
        break;
      case 'daysAgo':
        if (!filter.value) return emptyResult;
        anchorDate = now.add(-filter.value, 'day');
        break;
      case 'daysFromNow':
        if (!filter.value) return emptyResult;
        anchorDate = now.add(Number(filter.value), 'day');
        break;
      case 'exactDate':
        if (!filter.value) return emptyResult;
        anchorDate = this.parseFilterValue(
          filter.value,
          knex,
          filter,
          column,
          options,
        );
        anchorDate = filter.groupby ? anchorDate : anchorDate.startOf('day');
        break;
      // sub-ops for `isWithin` comparison
      case 'pastWeek':
        anchorDate = now.add(-1, 'week');
        break;
      case 'pastMonth':
        anchorDate = now.add(-1, 'month');
        break;
      case 'pastYear':
        anchorDate = now.add(-1, 'year');
        break;
      case 'nextWeek':
        anchorDate = now.add(1, 'week');
        break;
      case 'nextMonth':
        anchorDate = now.add(1, 'month');
        break;
      case 'nextYear':
        anchorDate = now.add(1, 'year');
        break;
      case 'pastNumberOfDays':
        if (!filter.value) return emptyResult;
        anchorDate = now.add(-filter.value, 'day');
        break;
      case 'nextNumberOfDays':
        if (!filter.value) return emptyResult;
        anchorDate = now.add(Number(filter.value), 'day');
        break;
    }
    // for straight date value without sub op
    if (!filter.comparison_sub_op && filter.value) {
      anchorDate = this.parseFilterValue(
        filter.value,
        knex,
        filter,
        column,
        options,
      );
      anchorDate = filter.groupby ? anchorDate : anchorDate.startOf('day');
      if (!anchorDate.isValid()) {
        return emptyResult;
      }
    }
    if (filter.comparison_op === 'isWithin') {
      return await this.filterIsWithin(
        { val: anchorDate.valueOf(), sourceField: field },
        { knex, filter, column },
        options,
      );
    }

    return await this.handleFilter(
      { val: anchorDate?.valueOf(), sourceField: field },
      { knex, filter, column },
      options,
    );
  }

  override async filterEq(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter & { groupby?: boolean };
      column: Column;
    },
    _options: FilterOptions,
  ) {
    const { knex, filter, column } = rootArgs;
    const anchorDate = dayjs.tz(
      args.val,
      this.getTimezone(knex, filter, column, _options),
    );
    const rangeDate = filter.groupby
      ? anchorDate.add(1, 'minute').add(-1, 'milliseconds')
      : anchorDate.add(24, 'hours').add(-1, 'milliseconds');

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          this.comparisonBetween(
            { ...args, anchorDate, rangeDate, qb: nestedQb },
            rootArgs,
            _options,
          );
        });
      },
    };
  }

  override async filterNeq(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ) {
    const anchorDate = dayjs(args.val);
    const rangeDate = anchorDate.add(24, 'hours').add(-1, 'milliseconds');

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        // is earlier than anchor date
        // or later than range date
        // or null
        qb.where((nestedQb) => {
          this.comparisonOp(
            { ...args, val: anchorDate, qb: nestedQb, comparisonOp: '<' },
            rootArgs,
            _options,
          );
          nestedQb.orWhere((nestedQb2) => {
            this.comparisonOp(
              { ...args, val: rangeDate, qb: nestedQb2, comparisonOp: '>' },
              rootArgs,
              _options,
            );
          });
          nestedQb.orWhereNull(args.sourceField as any);
        });
      },
    };
  }

  override async filterGt(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ): Promise<{ rootApply: any; clause: (qb: Knex.QueryBuilder) => void }> {
    const anchorDate = dayjs(args.val);
    let rangeDate = anchorDate.add(24, 'hours').add(-1, 'milliseconds');

    // when the given filter value has time component,
    // we use it raw as comparison
    if (rootArgs.filter.value?.replace('T', ' ').split(' ')[1]) {
      rangeDate = this.parseFilterValue(
        rootArgs.filter.value,
        rootArgs.knex,
        rootArgs.filter,
        rootArgs.column,
        _options,
      );
    }

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          this.comparisonOp(
            { ...args, val: rangeDate, qb: nestedQb, comparisonOp: '>' },
            rootArgs,
            _options,
          );
        });
      },
    };
  }

  override async filterGte(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ): Promise<{ rootApply: any; clause: (qb: Knex.QueryBuilder) => void }> {
    const anchorDate = dayjs(args.val);
    let rangeDate = anchorDate;

    // when the given filter value has time component,
    // we use it raw as comparison
    if (rootArgs.filter.value?.replace('T', ' ').split(' ')[1]) {
      rangeDate = this.parseFilterValue(
        rootArgs.filter.value,
        rootArgs.knex,
        rootArgs.filter,
        rootArgs.column,
        _options,
      );
    }

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          this.comparisonOp(
            { ...args, val: rangeDate, qb: nestedQb, comparisonOp: '>=' },
            rootArgs,
            _options,
          );
        });
      },
    };
  }

  override async filterLte(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ): Promise<{ rootApply: any; clause: (qb: Knex.QueryBuilder) => void }> {
    const anchorDate = dayjs(args.val);
    let rangeDate = anchorDate.add(24, 'hours').add(-1, 'milliseconds');

    // when the given filter value has time component,
    // we use it raw as comparison
    if (rootArgs.filter.value?.replace('T', ' ').split(' ')[1]) {
      rangeDate = this.parseFilterValue(
        rootArgs.filter.value,
        rootArgs.knex,
        rootArgs.filter,
        rootArgs.column,
        _options,
      );
    }

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          this.comparisonOp(
            { ...args, val: rangeDate, qb: nestedQb, comparisonOp: '<=' },
            rootArgs,
            _options,
          );
        });
      },
    };
  }

  override async filterLt(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ): Promise<{ rootApply: any; clause: (qb: Knex.QueryBuilder) => void }> {
    const anchorDate = dayjs(args.val);
    let rangeDate = anchorDate;

    // when the given filter value has time component,
    // we use it raw as comparison
    if (rootArgs.filter.value?.replace('T', ' ').split(' ')[1]) {
      rangeDate = this.parseFilterValue(
        rootArgs.filter.value,
        rootArgs.knex,
        rootArgs.filter,
        rootArgs.column,
        _options,
      );
    }

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          this.comparisonOp(
            { ...args, val: rangeDate, qb: nestedQb, comparisonOp: '<' },
            rootArgs,
            _options,
          );
        });
      },
    };
  }

  override async filterBlank(
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
    const { sourceField } = args;

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          nestedQb.whereNull(sourceField as any);
        });
      },
    };
  }

  override async filterNotblank(
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
    const { sourceField } = args;

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          nestedQb.whereNotNull(sourceField as any);
        });
      },
    };
  }

  async filterIsWithin(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ): Promise<{ rootApply: any; clause: (qb: Knex.QueryBuilder) => void }> {
    const { knex, filter, column } = rootArgs;
    const anchorDate = dayjs(args.val);
    const now = this.getNow(knex, filter, column, _options);
    let firstArg: dayjs.Dayjs;
    let secondArg: dayjs.Dayjs;
    if (now.isBefore(anchorDate)) {
      firstArg = now.startOf('day');
      secondArg = anchorDate.add(24, 'hours').add(-1, 'millisecond');
    } else {
      firstArg = anchorDate;
      secondArg = now.startOf('day').add(24, 'hours').add(-1, 'millisecond');
    }

    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          this.comparisonBetween(
            {
              ...args,
              anchorDate: firstArg,
              rangeDate: secondArg,
              qb: nestedQb,
            },
            rootArgs,
            _options,
          );
        });
      },
    };
  }
}
