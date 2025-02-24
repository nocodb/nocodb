import UITypes from '~/lib/UITypes';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { parseUserValue } from '../utils';

export class UserHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    if (
      !value ||
      [UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
        params.col?.uidt as UITypes
      )
    ) {
      return null;
    }

    try {
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
      return value;
    }
  }

  parseValue(value: any): string | null {
    return parseUserValue(value);
  }

  parsePlainCellValue(value: any): string {
    return this.parseValue(value) ?? '';
  }
}
