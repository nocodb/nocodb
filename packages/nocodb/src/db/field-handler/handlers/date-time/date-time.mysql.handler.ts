import { DateTimeGeneralHandler } from './date-time.general.handler';
import type dayjs from 'dayjs';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { FilterOptions } from '~/db/field-handler/field-handler.interface';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type { Column, Filter } from '~/models';

export class DateTimeMySQLHandler extends DateTimeGeneralHandler {
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
    const knex = params.options.baseModel.dbDriver;
    const dayjsUtcValue: dayjs.Dayjs = super.parseDateTime(params).value;

    // first convert the value to utc
    // from UI
    // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
    // from API
    // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
    // if timezone info is not found - considered as utc
    // e.g. 2022-01-01 20:00:00 -> 2022-01-01 20:00:00
    // if timezone info is found
    // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
    // e.g. 2022-01-01 20:00:00+00:00 -> 2022-01-01 20:00:00
    // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
    // then we use CONVERT_TZ to convert that in the db timezone
    const val = dayjsUtcValue
      ? knex.raw(`CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`, [
          dayjsUtcValue.format('YYYY-MM-DD HH:mm:ss'),
        ])
      : undefined;
    return { value: val };
  }

  // Normalize the column to UTC before comparing, so the WHERE clause
  // matches the same CONVERT_TZ normalization used in the group-by SELECT.
  // Without this, group-by expansion compares UTC filter values against
  // raw column values stored in @@GLOBAL.time_zone, causing empty groups.
  protected override comparisonBetween(
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
      knex.raw("CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00') between ? and ?", [
        sourceField,
        anchorDate.utc().format(this.dateValueFormat),
        rangeDate.utc().format(this.dateValueFormat),
      ]),
    );
  }

  protected override comparisonOp(
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
      knex.raw(
        `CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00') ${comparisonOp} ?`,
        [sourceField, val.utc().format(this.dateValueFormat)],
      ),
    );
  }
}
