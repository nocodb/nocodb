import { ColumnType } from '~/lib/Api';
import { populateFillHandleStrictCopy } from '../utils/fill-handler';
import { SingleLineTextHelper } from './SingleLineText';

export class UrlHelper extends SingleLineTextHelper {
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
