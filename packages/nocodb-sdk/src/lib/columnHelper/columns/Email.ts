import { parseProp } from '~/lib/helperFunctions';
import { SerializerOrParserFnProps } from '../column.interface';
import { SingleLineTextHelper } from './SingleLineText';
import { serializeStringValue } from '../utils';

export const extractEmail = (v: string) => {
  const matches = v.match(
    /(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})/i
  );
  return matches ? matches[0] : null;
};

export class EmailHelper extends SingleLineTextHelper {
  columnDefaultMeta = {};
  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    value = serializeStringValue(value);

    if (parseProp(params.col.meta).validate) {
      return extractEmail(value) || value;
    }
    return value;
  }
}
