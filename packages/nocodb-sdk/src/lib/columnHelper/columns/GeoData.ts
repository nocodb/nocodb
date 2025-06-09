import { ncIsNaN, ncIsString } from '~/lib/is';
import AbstractColumnHelper from '../column.interface';
import { SilentTypeConversionError } from '~/lib/error';
import { convertGeoNumberToString } from '~/lib/geoDataUtils';
import { ColumnType } from '~/lib/Api';
import { populateFillHandleStrictCopy } from '../utils/fill-handler';

export class GeoDataHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any): string | null {
    value = this.parseValue(value);

    if (value === null) {
      throw new SilentTypeConversionError();
    }

    return value;
  }

  parseValue(value: any): string | null {
    if (!ncIsString(value)) return null;

    const geoValue = value
      .replace(',', ';')
      .split(';')
      .map((k) => k.trim());

    if (geoValue.length === 2) {
      if (!ncIsNaN(geoValue[0]) && !ncIsNaN(geoValue[1])) {
        return geoValue
          .map((k) => convertGeoNumberToString(Number(k)))
          .join(';');
      }
    }

    return null;
  }

  parsePlainCellValue(value: any): string {
    return this.parseValue(value) ?? '';
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
