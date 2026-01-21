import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc.js';
import { type NcContext, ncIsUndefined } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type { FilterOptions } from '~/db/field-handler/field-handler.interface';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { MetaService } from '~/meta/meta.service';
import type { Column, Filter } from '~/models';
import { DateTimeGeneralHandler } from '~/db/field-handler/handlers/date-time/date-time.general.handler';
import { NcError } from '~/helpers/catchError';

dayjs.extend(utc);
dayjs.extend(timezone);

export class DateGeneralHandler extends DateTimeGeneralHandler {
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
    // Allow null/undefined values
    if (
      ncIsUndefined(params.value) ||
      params.value === null ||
      params.value === ''
    ) {
      return { value: params.value };
    }

    let dayjsUtcValue: dayjs.Dayjs;
    if (
      params.value instanceof Date ||
      typeof params.value === 'number' ||
      typeof params.value === 'string'
    ) {
      if (params.value instanceof Date) {
        dayjsUtcValue = dayjs(params.value).utc();
      } else if (typeof params.value === 'string') {
        dayjsUtcValue = dayjs(params.value).utc();
        if (!dayjsUtcValue.isValid() && params.column.meta?.date_format) {
          dayjsUtcValue = dayjs(
            params.value,
            params.column.meta?.date_format,
          ).utc();
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
    return { value: params.value };
  }

  dateValueFormat = 'YYYY-MM-DD';

  override comparisonBetween(
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
        anchorDate.format(this.dateValueFormat),
        rangeDate.format(this.dateValueFormat),
      ]),
    );
  }

  override comparisonOp(
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
        val.format(this.dateValueFormat),
      ]),
    );
  }
}
