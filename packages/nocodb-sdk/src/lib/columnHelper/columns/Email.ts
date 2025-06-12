import { parseProp } from '~/lib/helperFunctions';
import { SerializerOrParserFnProps } from '../column.interface';
import { SingleLineTextHelper } from './SingleLineText';
import { serializeEmail, serializeStringValue } from '../utils';
import { ColumnType } from '~/lib/Api';
import { populateFillHandleStrictCopy } from '../utils/fill-handler';

export class EmailHelper extends SingleLineTextHelper {
  columnDefaultMeta = {};
  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    value = serializeStringValue(value);

    if (parseProp(params.col.meta).validate) {
      return serializeEmail(value);
    }
    return value;
  }

  // simply copy highlighted rows
  override populateFillHandle(params: {
    column: ColumnType;
    highlightedData: any[];
    numberOfRows: number;
  }): any[] {
    return populateFillHandleStrictCopy(params);
  }
}
