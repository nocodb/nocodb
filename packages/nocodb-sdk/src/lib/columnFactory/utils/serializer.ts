import { ColumnType } from '~/lib/Api';
import { convertMS2Duration } from '~/lib/durationUtils';
import { parseProp } from '~/lib/helperFunctions';
import { ncIsNaN } from '~/lib/is';

export const serializeIntValue = (value: string | null | number) => {
  // We have to keep 0 as it is
  if (ncIsNaN(value)) {
    return null;
  }

  return Number(value) as number;
};

export const serializeDecimalValue = (
  value: null | number,
  col: ColumnType
) => {
  if (ncIsNaN(value)) {
    return null;
  }

  const columnMeta = parseProp(col.meta);

  return Number(value).toFixed(columnMeta?.precision ?? 1);
};

export const serializePercentValue = (value: string | null) => {
  if (!value || isNaN(Number(value))) {
    return null;
  }

  return `${value}%`;
};

export const serializeDurationValue = (
  value: string | null,
  col: ColumnType
) => {
  const columnMeta = parseProp(col.meta);

  if (columnMeta.duration === undefined) {
    return value;
  }

  return convertMS2Duration(value, columnMeta.duration);
};
