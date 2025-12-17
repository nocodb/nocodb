import { convertDurationToSeconds, parseProp } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import { NumberGeneralHandler } from '../number/number.general.handler';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from 'src/models';

export class DurationGeneralHandler extends NumberGeneralHandler {
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
    // Allow null/undefined/empty values
    if (
      params.value === null ||
      params.value === undefined ||
      params.value === ''
    ) {
      return { value: null };
    }

    let finalValue: number;

    // Get duration type from column meta
    const durationType = parseProp(params.column.meta)?.duration ?? 0;

    // Check if the value is a duration string format
    if (typeof params.value === 'string') {
      const trimmedValue = params.value.trim();

      // Try to parse as duration string (e.g., "00:02:33.000")
      const durationResult = convertDurationToSeconds(
        trimmedValue,
        durationType,
      );

      if (durationResult._isValid) {
        finalValue = durationResult._sec;
      } else {
        // If not a valid duration string, try to parse as number
        const numberValue = Number(trimmedValue);
        if (isNaN(numberValue)) {
          NcError.invalidValueForField({
            value: params.value,
            column: params.column.title,
            type: params.column.uidt,
          });
        }
        finalValue = numberValue;
      }
    } else if (typeof params.value === 'number') {
      finalValue = params.value;
    } else {
      // Try to convert to number
      const numberValue = Number(params.value);
      if (isNaN(numberValue)) {
        NcError.invalidValueForField({
          value: params.value,
          column: params.column.title,
          type: params.column.uidt,
        });
      }
      finalValue = numberValue;
    }

    // Validate that duration is non-negative
    if (finalValue < 0) {
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
      });
    }

    return { value: finalValue };
  }
}
