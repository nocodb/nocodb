import { type NcContext, ncIsUndefined } from 'nocodb-sdk';
import dayjs from 'dayjs';
import { NcError } from 'src/helpers/catchError';
import { DateTimeGeneralHandler } from '../date-time/date-time.general.handler';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from 'src/models';

export class DateGeneralHandler extends DateTimeGeneralHandler {
  override async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    baseModel: IBaseModelSqlV2;
    options?: { context?: NcContext; metaService?: MetaService };
  }): Promise<{ value: any }> {
    let dayjsUtcValue: dayjs.Dayjs;
    if (
      !ncIsUndefined(params.value) &&
      (params.value instanceof Date ||
        typeof params.value === 'number' ||
        typeof params.value === 'string')
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
    if (!dayjsUtcValue.isValid()) {
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
      });
    }
    return { value: params.value };
  }
}
