import { SilentTypeConversionError } from '~/lib/error';
import { parseIntValue, SeparatorType, serializeIntValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { toSafeInteger, parseProp } from '~/lib/helperFunctions';
import { ColumnType } from '~/lib/Api';
import { populateFillHandleStringNumber } from '../utils/fill-handler';
import { ncIsNaN } from '~/lib/is';
import { formatCustomNumber } from '../utils/customNumberFormat';

export class NumberHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    separator: SeparatorType.NonePeriod,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): number | null {
    value = serializeIntValue(value, params);

    if (value === null) {
      if (params.isMultipleCellPaste || params.serializeSearchQuery) {
        return null;
      } else {
        throw new SilentTypeConversionError();
      }
    }

    return toSafeInteger(value);
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

    return parseIntValue(value, params.col);
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

    return `${parseIntValue(value, params.col) ?? ''}`;
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
