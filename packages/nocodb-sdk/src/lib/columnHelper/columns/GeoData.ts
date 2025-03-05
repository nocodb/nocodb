import { ncIsString } from '~/lib/is';
import AbstractColumnHelper from '../column.interface';

export class GeoDataHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any): string | null {
    if (this.parseValue(value)) {
      return value;
    }

    return null;
  }

  parseValue(value: any): string | null {
    if (!ncIsString(value)) return null;

    const [latitude, longitude] = value.split(';');
    return latitude && longitude ? `${latitude}; ${longitude}` : null;
  }

  parsePlainCellValue(value: any): string {
    return this.parseValue(value) ?? '';
  }
}
