import { SilentTypeConversionError } from '~/lib/error';
import { parsePercentValue, serializePercentValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class PercentHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    is_progress: false,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): number | null {
    value = serializePercentValue(value);

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
    return parsePercentValue(value);
  }

  parsePlainCellValue(value: any): string {
    return `${parsePercentValue(value) ?? ''}`;
  }
}
