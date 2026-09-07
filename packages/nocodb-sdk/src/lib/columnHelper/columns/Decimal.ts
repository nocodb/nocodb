import { SilentTypeConversionError } from '~/lib/error';
import {
  parseDecimalValue,
  precisionFormats,
  SeparatorType,
  serializeDecimalValue,
} from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { populateFillHandleStringNumber } from '../utils/fill-handler';
import { ColumnType } from '~/lib/Api';
import { ncIsNaN } from '~/lib/is';
import { parseProp } from '~/lib/helperFunctions';
import { formatCustomNumber } from '../utils/customNumberFormat';

export class DecimalHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    precision: precisionFormats[1],
    separator: SeparatorType.NonePeriod,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): number | null {
    value = serializeDecimalValue(value, undefined, params);

    if (value === null) {
      if (params.isMultipleCellPaste || params.serializeSearchQuery) {
        return null;
      } else {
        throw new SilentTypeConversionError();
      }
    }

    return value;
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | number | null {
    // Return empty string for null/undefined values to prevent "null" text when pasting
    if (value === null || value === undefined) {
      return '';
    }

    const customFormat = parseProp(params.col?.meta)?.custom_format;
    if (customFormat) {
      return formatCustomNumber(value, customFormat);
    }

    return parseDecimalValue(value, params.col);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    if (params.isAggregation && ncIsNaN(value)) {
      value = 0;
    }

    const customFormat = parseProp(params.col?.meta)?.custom_format;
    if (customFormat) {
      return formatCustomNumber(value, customFormat);
    }

    return `${parseDecimalValue(value, params.col) ?? ''}`;
  }

  // using string number fill handler
  override populateFillHandle(params: {
    column: ColumnType;
    highlightedData: any[];
    numberOfRows: number;
  }): any[] {
    return populateFillHandleStringNumber(params);
  }
}
