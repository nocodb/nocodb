import { ncIsObject } from '~/lib/is';
import { parseDefault } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { ComputedTypePasteError } from '~/lib/error';
import { ButtonActionsType } from '~/lib/Api';

export class ButtonHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    _value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    if (params.isMultipleCellPaste) {
      return undefined;
    } else {
      throw new ComputedTypePasteError();
    }
  }

  parseValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string | null {
    if (!ncIsObject(value)) return null;

    value = value as Record<string, any>;

    if (value.type === ButtonActionsType.Url) return value.url;

    return parseDefault(value);
  }

  parsePlainCellValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string | null {
    return this.parseValue(value, _params) ?? '';
  }
}
