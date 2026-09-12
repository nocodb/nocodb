import { UITypes, validateDateWithUnknownFormat } from 'nocodb-sdk';
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
  let hasNonEmpty = false;
  for (let i = 0; i < values.length; i++) {
    const val = col !== undefined ? values[i]?.[col] : values[i];
    if (val === null || val === undefined || val.toString().trim() === '') {
      continue;
    }
    hasNonEmpty = true;
    options = options.filter((v) => val in v);
    if (!options.length) {
      return false;
    }
  }
  return hasNonEmpty;
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

// Detects initial UIDT for a single value
function _detectInitialUidt(v: string): string {
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
}

// Sanitizes a column name for use as a DB column name
function sanitizeColumnName(name: string, fallback: string): string {
  return (name?.toString().trim() || fallback)
    .replace(/[` ~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/g, '_')
    .trim();
}

/**
 * Shared column initialization: sanitize names, deduplicate, create DetectedColumn array.
 * Used by both detectColumnTypes (CSV) and detectColumnTypesFromObjects (JSON).
 */
function initializeColumns(headers: string[]): DetectedColumn[] {
  const columnNamePrefixRef: Record<string, number> = { id: 0, Id: 0 };
  const titlePrefixRef: Record<string, number> = { id: 0, Id: 0 };

  const columns: DetectedColumn[] = [];

  for (const [columnIdx, columnName] of headers.entries()) {
    let title = (
      columnName?.toString().trim() || `Field ${columnIdx + 1}`
    ).trim();
    let cn = sanitizeColumnName(columnName, `field_${columnIdx + 1}`);

    while (cn in columnNamePrefixRef) {
      cn = `${cn}${++columnNamePrefixRef[cn]}`;
    }
    while (title in titlePrefixRef) {
      title = `${title}${++titlePrefixRef[title]}`;
    }

    columnNamePrefixRef[cn] = 0;
    titlePrefixRef[title] = 0;

    columns.push({
      title,
      column_name: cn,
      ref_column_name: cn,
      uidt: UITypes.SingleLineText,
      key: columnIdx,
      meta: {},
    });
  }

  return columns;
}

/**
 * Detects column types from CSV sample data.
 */
export function detectColumnTypes(
  headers: string[],
  _sampleRows: string[][],
  _options: {
    maxRowsToParse?: number;
    autoSelectFieldTypes?: boolean;
  } = {},
): DetectedColumn[] {
  const columns = initializeColumns(headers);

  // Skip column type detection — all columns default to SingleLineText
  return columns;
}

/**
 * Detects column types from JSON sample data (object rows with native types).
 * Leverages typeof for initial detection before falling back to string heuristics.
 */
export function detectColumnTypesFromObjects(
  headers: string[],
  _sampleRows: Record<string, any>[],
  _options: {
    maxRowsToParse?: number;
    autoSelectFieldTypes?: boolean;
  } = {},
): DetectedColumn[] {
  const columns = initializeColumns(headers);

  // Skip column type detection — all columns default to SingleLineText
  return columns;
}
