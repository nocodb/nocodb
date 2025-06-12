import dayjs from 'dayjs';
import { dateFormats } from '~/lib/dateTimeHelper';
import {
  DATE_DIFF_TO_SCALE_LABEL_MAP,
  DATE_SCALE_LABEL_TO_DIFF_MAP,
  isNumberRound,
  parseDateValue,
  serializeDateOrDateTimeValue,
} from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { SilentTypeConversionError } from '~/lib/error';
import { ColumnType } from '~/lib/Api';
import { parseProp } from '~/lib/helperFunctions';
import { ncIsNullOrUndefined, ncIsUndefined } from '~/lib/is';
import { populateFillHandleStrictCopy } from '../utils/fill-handler';

export class DateHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    date_format: dateFormats[0],
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    value = serializeDateOrDateTimeValue(value, params.col);

    if (value === null) {
      if (params.isMultipleCellPaste) {
        return null;
      } else {
        throw new SilentTypeConversionError();
      }
    }

    return value;
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params'] & { isSystemCol?: boolean }
  ): string | null {
    return parseDateValue(value, params.col, params.isSystemCol);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params'] & { isSystemCol?: boolean }
  ): string | null {
    return parseDateValue(value, params.col, params.isSystemCol) ?? '';
  }

  override populateFillHandle(params: {
    column: ColumnType;
    highlightedData: any[];
    numberOfRows: number;
  }): any[] {
    const { column, highlightedData, numberOfRows } = params;
    // data is in form like 'YYYY-MM-DD' depends on meta dateformat
    const meta = parseProp(column.meta);
    const metaDateFormat = meta.date_format ?? 'YYYY-MM-DD';
    const dateFormat = metaDateFormat + ' HH:mm:ss';

    let lastData: dayjs.Dayjs;
    let modifier: number = undefined;
    let scale: 's' | 'm' | 'H' | 'D' | 'M' | 'Y' = 'D';

    const setModifierForScaleIfRound = (
      currentData: dayjs.Dayjs,
      lastData: dayjs.Dayjs,
      diffScale: string
    ) => {
      const currentModifier = currentData.diff(
        lastData,
        diffScale as any,
        true
      );
      if (isNumberRound(currentModifier)) {
        scale = DATE_DIFF_TO_SCALE_LABEL_MAP[diffScale];
        modifier = currentModifier;
      }
    };

    // map to dayjs
    const dayJsHighlightedData: dayjs.Dayjs[] = [];
    for (const date of highlightedData) {
      if (
        ncIsNullOrUndefined(date) ||
        date === '' ||
        typeof date !== 'string'
      ) {
        return populateFillHandleStrictCopy(params);
      }
      const currentData = dayjs(date + ' 00:00:00', dateFormat);
      // unlikely on normal case
      if (!currentData.isValid()) {
        return populateFillHandleStrictCopy(params);
      }
      if (!lastData) {
        lastData = currentData;
      } else {
        if (ncIsUndefined(modifier)) {
          const modifierInDays = currentData.diff(lastData, 'day');
          if (modifierInDays > 354) {
            setModifierForScaleIfRound(currentData, lastData, 'year');
          } else if (modifierInDays > 28) {
            setModifierForScaleIfRound(currentData, lastData, 'month');
          } else {
            modifier = modifierInDays;
            scale = 'D';
          }
        } else {
          const currentModifier = currentData.diff(
            lastData,
            DATE_SCALE_LABEL_TO_DIFF_MAP[scale] as any
          );
          if (currentModifier !== modifier) {
            return populateFillHandleStrictCopy(params);
          }
        }
        lastData = currentData;
      }

      dayJsHighlightedData.push(lastData);
    }

    if (modifier === 0) {
      return populateFillHandleStrictCopy(params);
    }

    const numberToGenerate = numberOfRows - highlightedData.length;
    return Array.from({ length: numberToGenerate }).map(() => {
      const currentData = lastData.add(
        modifier,
        DATE_SCALE_LABEL_TO_DIFF_MAP[scale] as any
      );

      lastData = currentData;
      return currentData.format(metaDateFormat);
    });
  }
}
