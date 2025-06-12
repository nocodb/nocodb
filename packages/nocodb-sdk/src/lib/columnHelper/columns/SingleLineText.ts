import { ColumnType } from '~/lib/Api';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { serializeStringValue } from '../utils';
import { populateFillHandleStringNumber } from '../utils/fill-handler';

export class SingleLineTextHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string | null {
    return serializeStringValue(value);
  }

  parseValue(value: any, _params: SerializerOrParserFnProps['params']): string {
    if (value === null || value === undefined) {
      return '';
    }
    return value.toString();
  }

  parsePlainCellValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string {
    return value?.toString() ?? '';
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
