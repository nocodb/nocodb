import { ColumnType } from '~/lib/Api';
import { SingleLineTextHelper } from './SingleLineText';
import { populateFillHandleStrictCopy } from '../utils/fill-handler';

export class PhoneNumberHelper extends SingleLineTextHelper {
  columnDefaultMeta = {};

  // simply copy highlighted rows
  override populateFillHandle(params: {
    column: ColumnType;
    highlightedData: any[];
    numberOfRows: number;
  }): any[] {
    return populateFillHandleStrictCopy(params);
  }
}
