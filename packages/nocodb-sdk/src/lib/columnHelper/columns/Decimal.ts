import { SilentTypeConversionError } from '~/lib/error';
import { parseDecimalValue, precisionFormats, serializeDecimalValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { populateFillHandleStringNumber } from '../utils/fill-handler';
import { ColumnType } from '~/lib/Api';
import { ncIsNaN } from '~/lib/is';

export class DecimalHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    precision: precisionFormats[1],
    isLocaleString: false,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): number | null {
    value = serializeDecimalValue(value);

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
    return parseDecimalValue(value, params.col);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    if (params.isAggregation && ncIsNaN(value)) {
      value = 0;
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
