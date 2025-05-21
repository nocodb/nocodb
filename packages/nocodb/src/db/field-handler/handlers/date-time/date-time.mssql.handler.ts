import { DateTimeGeneralHandler } from './date-time.general.handler';
import type dayjs from 'dayjs';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';

export class DateTimeMsSQLHandler extends DateTimeGeneralHandler {
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

    const val = knex.raw(
      `SWITCHOFFSET(CONVERT(datetimeoffset, ?), DATENAME(TzOffset, SYSDATETIMEOFFSET()))`,
      [dayjsUtcValue.format('YYYY-MM-DD HH:mm:ssZ')],
    );
    return { value: val };
  }
}
