import { SilentTypeConversionError } from '~/lib/error';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { parseYearValue, serializeYearValue } from '../utils';
import { ColumnType } from '~/lib/Api';
import { populateFillHandleStringNumber } from '../utils/fill-handler';

export class YearHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): number | null {
    value = serializeYearValue(value);

    if (value === null) {
      if (params.isMultipleCellPaste) {
        return null;
      } else {
        throw new SilentTypeConversionError();
      }
    }

    return value;
  }

  parseValue(value: any): string | number | null {
    return parseYearValue(value);
  }

  parsePlainCellValue(value: any): string {
    return `${parseYearValue(value) ?? ''}`;
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
