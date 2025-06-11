import { parseProp } from '~/lib/helperFunctions';
import { SerializerOrParserFnProps } from '../column.interface';
import { serializeEmail, serializeStringValue } from '../utils';
import { SingleLineTextHelper } from './SingleLineText';

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
}
