import { DateTimeGeneralHandler } from './date-time.general.handler';
import type dayjs from 'dayjs';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { FilterOptions } from '~/db/field-handler/field-handler.interface';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type { Column, Filter } from '~/models';

// The filters build inclusive range ends as `<next boundary> - 1ms`
const isInclusiveRangeEnd = (val: dayjs.Dayjs) => val.millisecond() === 999;

export class DateTimeSQLiteHandler extends DateTimeGeneralHandler {
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
    const dayjsUtcValue: dayjs.Dayjs = super.parseDateTime(params).value;

    // convert to UTC
    // e.g. 2022-01-01T10:00:00.000Z -> 2022-01-01 04:30:00.000+00:00
    const val = dayjsUtcValue?.format('YYYY-MM-DD HH:mm:ss.SSSZ');
    return { value: val };
  }

  // sqlite compares the stored text, where `23:59:59.700+00:00` (and the
  // second-precision `23:59:59+00:00`) sorts after a `23:59:59` bound. An
  // exclusive whole-second bound orders correctly for every stored shape.
  protected override comparisonBetween(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
      anchorDate: dayjs.Dayjs;
      rangeDate: dayjs.Dayjs;
      qb: Knex.QueryBuilder;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    options: FilterOptions,
  ) {
    if (!isInclusiveRangeEnd(args.rangeDate)) {
      return super.comparisonBetween(args, rootArgs, options);
    }
    args.qb.where(
      rootArgs.knex.raw('?? >= ? and ?? < ?', [
        args.sourceField,
        args.anchorDate.utc().format(this.dateValueFormat),
        args.sourceField,
        args.rangeDate.add(1, 'millisecond').utc().format(this.dateValueFormat),
      ]),
    );
  }

  protected override comparisonOp(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: dayjs.Dayjs;
      qb: Knex.QueryBuilder;
      comparisonOp: '<' | '<=' | '>' | '>=';
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    options: FilterOptions,
  ) {
    if (
      isInclusiveRangeEnd(args.val) &&
      (args.comparisonOp === '>' || args.comparisonOp === '<=')
    ) {
      return super.comparisonOp(
        {
          ...args,
          val: args.val.add(1, 'millisecond'),
          comparisonOp: args.comparisonOp === '>' ? '>=' : '<',
        },
        rootArgs,
        options,
      );
    }
    // a value with ms needs a ms bound; with the offset it sorts correctly
    // against both stored shapes and equals an identical stored value
    if (args.val.millisecond() !== 0) {
      args.qb.where(
        rootArgs.knex.raw(`?? ${args.comparisonOp} ?`, [
          args.sourceField,
          args.val.utc().format('YYYY-MM-DD HH:mm:ss.SSSZ'),
        ]),
      );
      return;
    }
    return super.comparisonOp(args, rootArgs, options);
  }
}
