import type { ColumnType } from 'nocodb-sdk';

export const normalizeObject = (obj) => {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
};

export const verifyColumnsInRsp = (
  row: Record<string, any>,
  columns: ColumnType[],
) => {
  const responseColumnsListStr = Object.keys(row).sort().join(',');
  const expectedColumnsListStr = columns
    .filter((c) => !c.system || c.pk)
    .map((c) => c.title)
    .sort()
    .join(',');

  return responseColumnsListStr === expectedColumnsListStr;
};

export function prepareRecords(
  title: string,
  count: number,
  start: number = 1,
  option?: {
    ignoreId: boolean;
  },
) {
  const records: Record<string, string | number>[] = [];
  for (let i = start; i <= start + count - 1; i++) {
    records.push({
      ...(option?.ignoreId ? {} : { Id: i }),
      [title]: `${title} ${i}`,
    });
  }
  return records;
}

export function getColumnId(columns: ColumnType[], title: string) {
  return columns.find((c) => c.title === title)!.id!;
}
export const idc = (r1: any, r2: any) => r1.Id - r2.Id;

export function initArraySeq(i: number, count: number) {
  return Array.from({ length: count }, (_, index) => i + index);
}
