import { ColumnType } from '~/lib/Api';
import { convertMS2Duration } from '~/lib/durationUtils';
import { parseProp } from '~/lib/helperFunctions';
import { ncIsNaN, ncIsNumber } from '~/lib/is';

export const parseIntValue = (
  value: string | null | number,
  col: ColumnType
) => {
  if (ncIsNaN(value)) {
    return null;
  }

  const columnMeta = parseProp(col.meta);

  if (columnMeta.isLocaleString) {
    return Number(value).toLocaleString();
  }

  return Number(value);
};

export const parseDecimalValue = (
  value: string | null | number,
  col: ColumnType
) => {
  if (ncIsNumber(value)) {
    return value;
  }

  if (!value || isNaN(Number(value))) {
    return null;
  }

  const columnMeta = parseProp(col.meta);

  return Number(value).toFixed(columnMeta?.precision ?? 1);
};

export const parsePercentValue = (value: string | null) => {
  if (!value || isNaN(Number(value))) {
    return null;
  }

  return `${value}%`;
};

export const parseDurationValue = (value: string | null, col: ColumnType) => {
  const durationType = parseProp(col.meta)?.duration || 0;
  return convertMS2Duration(value, durationType);
};
