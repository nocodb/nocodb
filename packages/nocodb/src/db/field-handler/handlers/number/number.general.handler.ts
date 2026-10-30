import { NcError } from 'src/helpers/catchError';
import { DecimalGeneralHandler } from '../decimal/decimal.general.handler';
import type { Column } from 'src/models';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { NcContext } from 'nocodb-sdk';
import type { MetaService } from 'src/meta/meta.service';

const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;

export class NumberGeneralHandler extends DecimalGeneralHandler {
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
    const value = (await super.parseUserInput(params))?.value;
    // An integer string past 2^53 stays a string so a bigint column keeps it exact.
    if (
      typeof params.value === 'string' &&
      /^[+-]?\d+$/.test(params.value.trim()) &&
      !Number.isSafeInteger(value)
    ) {
      const big = BigInt(params.value.trim());
      if (big < INT64_MIN || big > INT64_MAX) {
        NcError.invalidValueForField({
          value: params.value,
          column: params.column.title,
          type: params.column.uidt,
        });
      }
      return { value: params.value.trim() };
    }
    // Fractions are for Decimal; past 2^53 the value is not exact and the
    // database rejects it without naming the column.
    if (
      typeof value === 'number' &&
      (!Number.isSafeInteger(value) || Math.floor(value) !== Math.ceil(value))
    ) {
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
      });
    }
    return { value };
  }
}
