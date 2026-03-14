import {
  getDateFormat,
  UITypes,
  validateDateWithUnknownFormat,
} from 'nocodb-sdk';
import isURL from 'validator/lib/isURL';

// Boolean option pairs for checkbox detection
const booleanOptions = [
  { checked: true, unchecked: false },
  { x: true, '': false },
  { yes: true, no: false },
  { y: true, n: false },
  { 1: true, 0: false },
  { '[x]': true, '[]': false, '[ ]': false },
  { '☑': true, '': false },
  { '✅': true, '': false },
  { '✓': true, '': false },
  { '✔': true, '': false },
  { enabled: true, disabled: false },
  { on: true, off: false },
  { done: true, '': false },
  { true: true, false: false },
];

const aggBooleanOptions: Record<string, boolean> = booleanOptions.reduce(
  (obj, o) => ({ ...obj, ...o }),
  {},
);

const validateEmail = (v: string) =>
  /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i.test(
    v,
  );

export function isCheckboxType(values: any[], col?: number): boolean {
  let options = booleanOptions;
  for (let i = 0; i < values.length; i++) {
    const val = col !== undefined ? values[i]?.[col] : values[i];
    if (val === null || val === undefined || val.toString().trim() === '') {
      continue;
    }
    options = options.filter((v) => val in v);
    if (!options.length) {
      return false;
    }
  }
  return true;
}

export function getCheckboxValue(value: any): boolean {
  return value && aggBooleanOptions[value];
}

export function isMultiLineTextType(values: any[], col?: number): boolean {
  return values.some((r) => {
    const v = col !== undefined ? r?.[col] : r;
    return (
      (v || '').toString().match(/[\r\n]/) || (v || '').toString().length > 255
    );
  });
}

export function isEmailType(values: any[], col?: number): boolean {
  return values.some((r) => {
    const v = col !== undefined ? r?.[col] : r;
    return v && validateEmail(v);
  });
}

export function isUrlType(values: any[], col?: number): boolean {
  return values.some((r) => {
    const v = col !== undefined ? r?.[col] : r;
    return v && isURL(v.toString());
  });
}

export function isDecimalType(colData: any[]): boolean {
  return colData.some((v) => v && parseInt(v) !== +v);
}

export function extractMultiOrSingleSelectProps(
  colData: any[],
): Record<string, any> {
  const maxSelectOptionsAllowed = 64;
  const colProps: Record<string, any> = {};

  if (colData.some((v) => v && (v || '').toString().includes(','))) {
    const flattenedVals = colData.flatMap((v) =>
      v
        ? v
            .toString()
            .trim()
            .split(/\s*,\s*/)
        : [],
    );
    const uniqueVals = [
      ...new Set(
        flattenedVals
          .filter((v) => v !== null && v !== undefined)
          .map((v) => v.toString().trim()),
      ),
    ];

    if (uniqueVals.length > maxSelectOptionsAllowed) {
      colProps.uidt = UITypes.SingleLineText;
    } else {
      if (
        flattenedVals.length > uniqueVals.length &&
        uniqueVals.length <= Math.ceil(flattenedVals.length / 2)
      ) {
        colProps.uidt = UITypes.MultiSelect;
      }
      colProps.dtxp = `${uniqueVals
        .map((v) => `'${v.replace(/'/gi, "''")}'`)
        .join(',')}`;
    }
  } else {
    const uniqueVals = [
      ...new Set(
        colData
          .filter((v) => v !== null && v !== undefined)
          .map((v) => v.toString().trim()),
      ),
    ];

    if (uniqueVals.length > maxSelectOptionsAllowed) {
      colProps.uidt = UITypes.SingleLineText;
    } else {
      if (
        colData.length > uniqueVals.length &&
        uniqueVals.length <= Math.ceil(colData.length / 2)
      ) {
        colProps.uidt = UITypes.SingleSelect;
      }
      colProps.dtxp = `${uniqueVals
        .map((v) => `'${v.replace(/'/gi, "''")}'`)
        .join(',')}`;
    }
  }

  return colProps;
}

// Comprehensive type detection for a column (used by JSON adapter)
export function getColumnUIDTAndMetas(
  colData: any[],
  defaultType: string,
): Record<string, any> {
  const colProps: Record<string, any> = { uidt: defaultType };

  if (colProps.uidt === UITypes.SingleLineText) {
    if (isMultiLineTextType(colData)) {
      colProps.uidt = UITypes.LongText;
    }
    if (isEmailType(colData)) {
      colProps.uidt = UITypes.Email;
    }
    if (isUrlType(colData)) {
      colProps.uidt = UITypes.URL;
    } else {
      if (isCheckboxType(colData)) {
        colProps.uidt = UITypes.Checkbox;
      } else {
        Object.assign(colProps, extractMultiOrSingleSelectProps(colData));
      }
    }
  } else if (colProps.uidt === UITypes.Number) {
    if (isDecimalType(colData)) {
      colProps.uidt = UITypes.Decimal;
    }
  }
  return colProps;
}

// Detects initial UIDT for a single value
function detectInitialUidt(v: string): string {
  if (!isNaN(Number(v)) && !isNaN(parseFloat(v))) return UITypes.Number;
  if (validateDateWithUnknownFormat(v)) return UITypes.DateTime;
  if (isCheckboxType([v])) return UITypes.Checkbox;
  return UITypes.SingleLineText;
}

export interface DetectedColumn {
  title: string;
  column_name: string;
  ref_column_name: string;
  uidt: string;
  key: number;
  meta: Record<string, any>;
  dtxp?: string;
  path?: string[];
}

/**
 * Detects column types from CSV sample data.
 */
export function detectColumnTypes(
  headers: string[],
  sampleRows: string[][],
  options: {
    maxRowsToParse?: number;
    autoSelectFieldTypes?: boolean;
  } = {},
): DetectedColumn[] {
  const { maxRowsToParse = 500, autoSelectFieldTypes = true } = options;

  const detectedColumnTypes: Record<number, Record<string, number>> = {};
  const distinctValues: Record<number, Set<string>> = {};
  const columnValues: Record<number, string[]> = {};

  const columnNamePrefixRef: Record<string, number> = { id: 0, Id: 0 };
  const titlePrefixRef: Record<string, number> = { id: 0, Id: 0 };

  const columns: DetectedColumn[] = [];

  for (const [columnIdx, columnName] of headers.entries()) {
    let title = (
      columnName?.toString().trim() || `Field ${columnIdx + 1}`
    ).trim();
    let cn = (columnName?.toString().trim() || `field_${columnIdx + 1}`)
      .replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/g, '_')
      .trim();

    while (cn in columnNamePrefixRef) {
      cn = `${cn}${++columnNamePrefixRef[cn]}`;
    }
    while (title in titlePrefixRef) {
      title = `${title}${++titlePrefixRef[title]}`;
    }

    columnNamePrefixRef[cn] = 0;
    titlePrefixRef[title] = 0;

    detectedColumnTypes[columnIdx] = {};
    distinctValues[columnIdx] = new Set<string>();
    columnValues[columnIdx] = [];

    columns.push({
      title,
      column_name: cn,
      ref_column_name: cn,
      uidt: UITypes.SingleLineText,
      key: columnIdx,
      meta: {},
    });
  }

  if (!autoSelectFieldTypes) {
    return columns;
  }

  for (const row of sampleRows.slice(0, maxRowsToParse)) {
    for (let columnIdx = 0; columnIdx < headers.length; columnIdx++) {
      const cellValue = row[columnIdx];
      if (!cellValue) continue;

      const colData = [cellValue];
      const colProps = { uidt: detectInitialUidt(cellValue) };

      if (isMultiLineTextType(colData)) {
        colProps.uidt = UITypes.LongText;
      } else if (colProps.uidt === UITypes.SingleLineText) {
        if (isEmailType(colData)) {
          colProps.uidt = UITypes.Email;
        } else if (isUrlType(colData)) {
          colProps.uidt = UITypes.URL;
        } else if (isCheckboxType(colData)) {
          colProps.uidt = UITypes.Checkbox;
        } else {
          if (cellValue && columnIdx < maxRowsToParse) {
            columnValues[columnIdx].push(cellValue);
            colProps.uidt = UITypes.SingleSelect;
          }
        }
      } else if (colProps.uidt === UITypes.Number) {
        if (isDecimalType(colData)) {
          colProps.uidt = UITypes.Decimal;
        }
      } else if (colProps.uidt === UITypes.DateTime) {
        if (cellValue && columnIdx < maxRowsToParse) {
          columnValues[columnIdx].push(cellValue);
        }
      }

      if (!(colProps.uidt in detectedColumnTypes[columnIdx])) {
        detectedColumnTypes[columnIdx] = {
          ...detectedColumnTypes[columnIdx],
          [colProps.uidt]: 0,
        };
      }
      detectedColumnTypes[columnIdx][colProps.uidt] += 1;

      if (cellValue) {
        distinctValues[columnIdx].add(cellValue);
      }
    }
  }

  for (let columnIdx = 0; columnIdx < headers.length; columnIdx++) {
    const detectedColTypes = detectedColumnTypes[columnIdx];
    const len = Object.keys(detectedColTypes).length;

    let uidt: string;

    if (len === 0) {
      uidt = UITypes.SingleLineText;
    } else if (
      len === 2 &&
      UITypes.Number in detectedColTypes &&
      UITypes.Decimal in detectedColTypes
    ) {
      uidt = UITypes.Decimal;
    } else if (len > 1) {
      uidt =
        UITypes.LongText in detectedColTypes
          ? UITypes.LongText
          : UITypes.SingleLineText;
    } else {
      uidt = Object.keys(detectedColTypes)[0];
    }

    if (columnValues[columnIdx]?.length > 0) {
      if (uidt === UITypes.DateTime) {
        const dateFormat: Record<string, number> = {};
        const allDatesOnly = columnValues[columnIdx]
          .slice(0, maxRowsToParse)
          .every((v) => {
            const isDate = v.split(' ').length === 1;
            if (isDate) {
              dateFormat[getDateFormat(v)] =
                (dateFormat[getDateFormat(v)] || 0) + 1;
            }
            return isDate;
          });

        if (allDatesOnly) {
          columns[columnIdx].uidt = UITypes.Date;
          const objKeys = Object.keys(dateFormat);
          columns[columnIdx].meta.date_format = objKeys.length
            ? objKeys.reduce((x, y) => (dateFormat[x] > dateFormat[y] ? x : y))
            : 'YYYY/MM/DD';
        } else {
          columns[columnIdx].uidt = uidt;
        }
      } else if (
        uidt === UITypes.SingleSelect ||
        uidt === UITypes.MultiSelect
      ) {
        columns[columnIdx].uidt = UITypes.SingleLineText;
        const selectProps = extractMultiOrSingleSelectProps(
          columnValues[columnIdx],
        );
        Object.assign(columns[columnIdx], selectProps);
      } else {
        columns[columnIdx].uidt = uidt;
      }
    } else {
      columns[columnIdx].uidt = uidt;
    }
  }

  return columns;
}

// ---------- Excel type detection ----------

const excelTypeToUidt: Record<string, string> = {
  d: UITypes.DateTime,
  b: UITypes.Checkbox,
  n: UITypes.Number,
  s: UITypes.SingleLineText,
};

/**
 * Detects column types from Excel parsed data (rows as arrays).
 * Mirrors ExcelTemplateAdapter logic.
 */
export function detectExcelColumnTypes(
  rows: any[][],
  ws: any,
  range: any,
  xlsx: any,
  options: {
    firstRowAsHeaders?: boolean;
    maxRowsToParse?: number;
    autoSelectFieldTypes?: boolean;
    importDataOnly?: boolean;
  } = {},
): DetectedColumn[] {
  const {
    firstRowAsHeaders = true,
    maxRowsToParse = 500,
    autoSelectFieldTypes = true,
    importDataOnly = false,
  } = options;

  if (!rows.length || !rows[0]?.length) return [];

  const columnNamePrefixRef: Record<string, number> = { id: 0, Id: 0 };
  const titlePrefixRef: Record<string, number> = { id: 0, Id: 0 };
  const columns: DetectedColumn[] = [];

  for (let col = 0; col < rows[0].length; col++) {
    let title = (
      (firstRowAsHeaders && rows[0]?.[col]?.toString().trim()) ||
      `Field ${col + 1}`
    ).trim();
    let cn = (
      (firstRowAsHeaders && rows[0]?.[col]?.toString().trim()) ||
      `field_${col + 1}`
    )
      .replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/g, '_')
      .trim();

    while (cn in columnNamePrefixRef) {
      cn = `${cn}${++columnNamePrefixRef[cn]}`;
    }
    columnNamePrefixRef[cn] = 0;
    while (title in titlePrefixRef) {
      title = `${title}${++titlePrefixRef[title]}`;
    }
    titlePrefixRef[title] = 0;

    const column: DetectedColumn = {
      title,
      column_name: cn,
      ref_column_name: cn,
      uidt: UITypes.SingleLineText,
      key: col,
      meta: {},
    };

    if (autoSelectFieldTypes && ws && range) {
      const cellId = xlsx.utils.encode_cell({
        c: range.s.c + col,
        r: +firstRowAsHeaders,
      });
      const cellProps = ws[cellId] || {};
      column.uidt = importDataOnly
        ? excelTypeToUidt[cellProps.t] || UITypes.SingleLineText
        : UITypes.SingleLineText;

      if (column.uidt === UITypes.SingleLineText && importDataOnly) {
        if (isMultiLineTextType(rows, col)) {
          column.uidt = UITypes.LongText;
        } else if (isEmailType(rows, col)) {
          column.uidt = UITypes.Email;
        } else if (isUrlType(rows, col)) {
          column.uidt = UITypes.URL;
        } else {
          const vals = rows
            .slice(+firstRowAsHeaders)
            .map((r) => r[col])
            .filter(
              (v) =>
                v !== null && v !== undefined && v.toString().trim() !== '',
            );

          if (isCheckboxType(vals)) {
            column.uidt = UITypes.Checkbox;
          } else {
            Object.assign(column, extractMultiOrSingleSelectProps(vals));
          }
        }
      } else if (column.uidt === UITypes.Number) {
        if (
          rows
            .slice(1, maxRowsToParse)
            .some((v) => v && v[col] && parseInt(v[col]) !== +v[col])
        ) {
          column.uidt = UITypes.Decimal;
        }
        // Currency detection
        if (
          rows.slice(1, maxRowsToParse).every((v, i) => {
            const cId = xlsx.utils.encode_cell({
              c: range.s.c + col,
              r: i + +firstRowAsHeaders,
            });
            const cellObj = ws[cId];
            return !cellObj || (cellObj.w && cellObj.w.startsWith('$'));
          })
        ) {
          column.uidt = UITypes.Currency;
        }
        // Non-numeric fallback
        if (
          rows.slice(1, maxRowsToParse).some((_v, i) => {
            const cId = xlsx.utils.encode_cell({
              c: range.s.c + col,
              r: i + +firstRowAsHeaders,
            });
            const cellObj = ws[cId];
            return (
              !cellObj ||
              (cellObj.w &&
                !(!isNaN(Number(cellObj.w)) && !isNaN(parseFloat(cellObj.w))))
            );
          })
        ) {
          column.uidt = UITypes.SingleLineText;
        }
      } else if (column.uidt === UITypes.DateTime) {
        const dateFormat: Record<string, number> = {};
        if (
          rows.slice(1, maxRowsToParse).every((_v, i) => {
            const cId = xlsx.utils.encode_cell({
              c: range.s.c + col,
              r: i + +firstRowAsHeaders,
            });
            const cellObj = ws[cId];
            const isDate =
              !cellObj || (cellObj.w && cellObj.w.split(' ').length === 1);
            if (isDate && cellObj) {
              dateFormat[getDateFormat(cellObj.w)] =
                (dateFormat[getDateFormat(cellObj.w)] || 0) + 1;
            }
            return isDate;
          })
        ) {
          column.uidt = UITypes.Date;
          column.meta.date_format =
            Object.keys(dateFormat).reduce((x, y) =>
              dateFormat[x] > dateFormat[y] ? x : y,
            ) || 'YYYY/MM/DD';
        }
      }
    }

    columns.push(column);
  }

  return columns;
}

// ---------- JSON type detection ----------

const jsonTypeToUidt: Record<string, string> = {
  number: UITypes.Number,
  string: UITypes.SingleLineText,
  date: UITypes.DateTime,
  boolean: UITypes.Checkbox,
  object: UITypes.JSON,
};

const extractNestedData = (obj: any, path: any[]) =>
  path.reduce((val: any, key: any) => val && val[key], obj);

/**
 * Detects columns from JSON data.
 * Mirrors JSONTemplateAdapter logic.
 */
export function detectJsonColumns(
  jsonData: Record<string, any>[],
  options: {
    normalizeNested?: boolean;
    autoSelectFieldTypes?: boolean;
  } = {},
): DetectedColumn[] {
  const { normalizeNested = true, autoSelectFieldTypes = true } = options;

  if (!jsonData.length) return [];

  const columns: DetectedColumn[] = [];
  let keyIdx = 0;

  function parseColumn(path: string[], firstRowVal: any) {
    if (
      firstRowVal &&
      typeof firstRowVal === 'object' &&
      !Array.isArray(firstRowVal) &&
      normalizeNested
    ) {
      for (const key of Object.keys(firstRowVal)) {
        parseColumn([...path, key], firstRowVal[key]);
      }
    } else {
      const title = path.join(' ').trim();
      const cn = path.join('_').replace(/\W/g, '_').trim();
      const column: DetectedColumn = {
        title,
        column_name: cn,
        ref_column_name: cn,
        uidt: UITypes.SingleLineText,
        key: keyIdx++,
        meta: {},
        path,
      };

      if (autoSelectFieldTypes) {
        column.uidt =
          jsonTypeToUidt[typeof firstRowVal] || UITypes.SingleLineText;
        const colData = jsonData.map((r) => extractNestedData(r, path));
        Object.assign(column, getColumnUIDTAndMetas(colData, column.uidt));
      }

      columns.push(column);
    }
  }

  for (const col of Object.keys(jsonData[0])) {
    parseColumn([col], jsonData[0][col]);
  }

  return columns;
}

/**
 * Parse JSON data rows using detected columns.
 */
export function parseJsonRows(
  jsonData: Record<string, any>[],
  columns: DetectedColumn[],
): Record<string, any>[] {
  const rows: Record<string, any>[] = [];

  for (const row of jsonData) {
    const rowData: Record<string, any> = {};
    for (const col of columns) {
      const value = extractNestedData(row, col.path || [col.column_name]);
      if (col.uidt === UITypes.Checkbox) {
        rowData[col.column_name] = getCheckboxValue(value);
      } else if (
        col.uidt === UITypes.SingleSelect ||
        col.uidt === UITypes.MultiSelect
      ) {
        rowData[col.column_name] = (value || '').toString().trim() || null;
      } else if (col.uidt === UITypes.JSON) {
        rowData[col.column_name] = JSON.stringify(value);
      } else {
        rowData[col.column_name] = value;
      }
    }
    rows.push(rowData);
  }

  return rows;
}
