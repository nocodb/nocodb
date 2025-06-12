import { ColumnType } from '~/lib/Api';
import { ncIsNullOrUndefined, ncIsUndefined } from '~/lib/is';
const fillHandlerSuffixRegex = /(.*)(\d+)$/;

// follow google sheet behavior
export function populateFillHandleStringNumber({
  highlightedData,
  numberOfRows,
}: {
  column: ColumnType;
  highlightedData: any[];
  numberOfRows: number;
}) {
  const nullPrefix = Symbol('nullPrefix');
  const emptyCell = Symbol('empty');
  const group: Record<
    string | symbol,
    {
      prefix: string | symbol;
      data: number[];
      modifier: number;
      lastIndex: number | undefined;
    }
  > = {};
  const groupIndex: Record<
    number,
    {
      group: {
        prefix: string | symbol;
        data: number[];
        modifier: number;
        lastIndex: number | undefined;
      };
      row: any;
    }
  > = {};
  const rowToFill = numberOfRows - highlightedData.length;
  if (rowToFill <= 0) {
    return [];
  }
  let highLightIndex = 0;
  for (const highlightedRow of highlightedData) {
    let index;
    let groupKey;
    if (typeof highlightedRow === 'string') {
      const regexResult = highlightedRow.match(fillHandlerSuffixRegex);
      if (!regexResult) {
        if (highlightedRow !== '') {
          groupKey = highlightedRow;
        }
      } else {
        const [_match, ...rest] = regexResult;
        groupKey = rest[0];
        index = rest[1];
        if (groupKey === '') {
          groupKey = nullPrefix;
        }
      }
    } else if (typeof highlightedRow === 'number') {
      groupKey = nullPrefix;
      index = highlightedRow;
    }
    if (ncIsNullOrUndefined(groupKey) && ncIsNullOrUndefined(index)) {
      groupIndex[highLightIndex++] = {
        group: {
          data: [],
          modifier: 0,
          prefix: emptyCell,
          lastIndex: undefined,
        },
        row: undefined,
      };
      continue;
    }
    if (!group[groupKey ?? nullPrefix]) {
      group[groupKey ?? nullPrefix] = {
        prefix: groupKey ?? nullPrefix,
        data: [],
        modifier: 0,
        lastIndex: 0,
      };
    }
    const groupData = group[groupKey ?? nullPrefix].data;

    groupData.push(index);
    groupIndex[highLightIndex++] = {
      group: group[groupKey ?? nullPrefix],
      row: index,
    };
  }

  // loop once more to set modifier
  for (const [_prefix, groupRecord] of Object.entries(group)) {
    if (groupRecord.data.length > 1) {
      let lastData = Number(groupRecord.data[1]);
      let modifier = lastData - Number(groupRecord.data[0]);
      for (const current of groupRecord.data.slice(2)) {
        if (Number(current) - lastData !== modifier) {
          modifier = 0;
          break;
        }
        lastData = Number(current);
      }
      groupRecord.modifier = modifier;
      groupRecord.lastIndex = lastData;
    }
  }

  // for pure number, the logic is different following google sheet
  if (group[nullPrefix]?.data?.length > 1) {
    let sumOfModifier = 0;
    let lastData = Number(group[nullPrefix].data[1]);
    sumOfModifier = lastData - Number(group[nullPrefix].data[0]);

    for (const current of group[nullPrefix].data.slice(2)) {
      sumOfModifier += Number(current) - lastData;
      lastData = Number(current);
    }
    group[nullPrefix].modifier =
      sumOfModifier / (group[nullPrefix]?.data?.length - 1);
    group[nullPrefix].lastIndex = lastData;
  }
  const result: any[] = [];
  for (let fillingIndex = 0; fillingIndex < rowToFill; fillingIndex++) {
    const groupOfIndex = groupIndex[fillingIndex % highlightedData.length];
    if (emptyCell === groupOfIndex.group.prefix) {
      result.push(null);
    } else if (
      typeof groupOfIndex.group.prefix === 'string' &&
      groupOfIndex.group.modifier === 0
    ) {
      const rowStr = ncIsUndefined(groupOfIndex.row) ? '' : groupOfIndex.row;
      result.push(`${groupOfIndex.group.prefix}${rowStr}`);
    } else {
      groupOfIndex.group.lastIndex += groupOfIndex.group.modifier;
      result.push(
        `${
          groupOfIndex.group.prefix === nullPrefix
            ? ''
            : (groupOfIndex.group.prefix as string)
        }${groupOfIndex.group.lastIndex}`
      );
    }
  }
  return result;
}

// simply copy the value repeatedly
export function populateFillHandleStrictCopy({
  highlightedData,
  numberOfRows,
}: {
  column: ColumnType;
  highlightedData: any[];
  numberOfRows: number;
}): any[] {
  const result: any[] = [];

  for (let i = 0; i < numberOfRows - highlightedData.length; i++) {
    result.push(highlightedData[i % highlightedData.length]);
  }
  return result;
}

