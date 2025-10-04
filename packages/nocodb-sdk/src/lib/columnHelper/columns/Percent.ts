import { SilentTypeConversionError } from '~/lib/error';
import { parsePercentValue, serializeDecimalValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { ColumnType } from '~/lib/Api';
import { populateFillHandleStringNumber } from '../utils/fill-handler';
import { ncIsNaN } from '~/lib/is';
import { parseProp } from '~/lib/helperFunctions';

export class PercentHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    is_progress: false,
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

  parseValue(value: any, col?: ColumnType): string | number | null {
    // Use precision from meta if available, parsing meta if it's a string
    const meta = parseProp(col?.meta);
    const precision = meta?.precision ?? 1;
    return parsePercentValue(value, precision);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    if (params.isAggregation && ncIsNaN(value)) {
      value = 0;
    }
    const meta = parseProp(params.col?.meta);
    const precision = meta?.precision ?? 1;
    return `${parsePercentValue(value, precision) ?? ''}`;
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
