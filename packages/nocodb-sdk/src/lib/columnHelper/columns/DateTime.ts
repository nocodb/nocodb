import {
  constructTimeFormat,
  dateFormats,
  timeFormats,
} from '~/lib/dateTimeHelper';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import {
  DATE_DIFF_TO_SCALE_LABEL_MAP,
  DATE_SCALE_LABEL_TO_DIFF_MAP,
  isNumberRound,
  parseDateTimeValue,
  serializeDateOrDateTimeValue,
} from '../utils';
import { SilentTypeConversionError } from '~/lib/error';
import { populateFillHandleStrictCopy } from '../utils/fill-handler';
import { ColumnType } from '~/lib/Api';
import { parseProp } from '~/lib/helperFunctions';
import dayjs from 'dayjs';
import { ncIsNullOrUndefined, ncIsUndefined } from '~/lib/is';

export class DateTimeHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    date_format: dateFormats[0],
    time_format: timeFormats[0],
    is12hrFormat: false,
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
    params: SerializerOrParserFnProps['params']
  ): string | null {
    return parseDateTimeValue(value, params);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    return parseDateTimeValue(value, params) ?? '';
  }

  override populateFillHandle(params: {
    column: ColumnType;
    highlightedData: any[];
    numberOfRows: number;
  }): any[] {
    const { column, highlightedData, numberOfRows } = params;
    // data is in form like 'YYYY-MM-DD HH:mm' depends on meta dateformat
    const meta = parseProp(column.meta);
    const metaDateFormat = meta.date_format ?? 'YYYY-MM-DD';
    const metaTimeFormat = constructTimeFormat(params.column);
    const dateTimeFormat = `${metaDateFormat} ${metaTimeFormat}`;

    let lastData: dayjs.Dayjs;
    let modifier: number = undefined;
    let scale: 's' | 'm' | 'H' | 'D' | 'M' | 'Y' = 's';
    let canUseSecondScale = true;
    if (!dateTimeFormat.includes('ss')) {
      canUseSecondScale = false;
    }
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
      const currentData = dayjs(date, dateTimeFormat);
      // unlikely on normal case
      if (!currentData.isValid()) {
        return populateFillHandleStrictCopy(params);
      }
      if (!lastData) {
        lastData = currentData;
      } else {
        if (ncIsUndefined(modifier)) {
          const modifierInSeconds = currentData.diff(lastData, 'second');
          if (modifierInSeconds > 60 * 60 * 24 * 354) {
            setModifierForScaleIfRound(currentData, lastData, 'year');
          } else if (modifierInSeconds > 60 * 60 * 24 * 28) {
            setModifierForScaleIfRound(currentData, lastData, 'month');
          } else if (modifierInSeconds > 60 * 60 * 24) {
            setModifierForScaleIfRound(currentData, lastData, 'day');
          } else if (modifierInSeconds > 60 * 60) {
            setModifierForScaleIfRound(currentData, lastData, 'hour');
          } else if (modifierInSeconds > 60) {
            setModifierForScaleIfRound(currentData, lastData, 'minute');
          } else if (!canUseSecondScale) {
            modifier = currentData.diff(lastData, 'minute');
            scale = 'm';
          } else {
            modifier = modifierInSeconds;
            scale = 's';
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
      return currentData.format(dateTimeFormat);
    });
  }
}
