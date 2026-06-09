import { UITypes } from 'nocodb-sdk';

// CWE-1236 (CSV / spreadsheet formula injection) guard for user-facing CSV exports.
// A cell whose text starts with =, +, -, @, tab or CR is evaluated as a live formula
// when the file is opened in Excel / LibreOffice / Google Sheets. Prefixing such values
// with a single quote forces the spreadsheet to treat them as literal text.
//
// This is applied ONLY to user-facing CSV exports (not to the duplicate/migrate/export
// re-import CSVs, which read the value back verbatim) and ONLY to text-type cells —
// numeric/temporal columns legitimately lead with - / + (negative or signed values), so
// escaping them would corrupt the data.
const NC_FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;

// uidt values whose serialized output must NOT be escaped (would mangle real data).
export const NC_FORMULA_ESCAPE_SKIP_UITYPES = new Set<string>([
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Rating,
  UITypes.Duration,
  UITypes.Year,
  UITypes.Date,
  UITypes.DateTime,
  UITypes.Time,
  UITypes.Checkbox,
  UITypes.AutoNumber,
  UITypes.ID,
]);

// Prefix a formula-leading string value with a single quote; leave anything else as-is.
export function escapeCsvFormulaValue(value: unknown): unknown {
  return typeof value === 'string' && NC_FORMULA_TRIGGER_RE.test(value)
    ? `'${value}`
    : value;
}

// Escape formula-leading string cells in-place across `rows` (keyed by column title, the
// serialized export shape). Cells in numeric/temporal columns are skipped; keys with no
// matching column are escaped (secure default).
export function escapeFormulaeInRows(
  rows: any[],
  columns: { title?: string | null; uidt?: string }[],
): void {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const skipTitles = new Set(
    columns
      .filter((c) => c.uidt && NC_FORMULA_ESCAPE_SKIP_UITYPES.has(c.uidt))
      .map((c) => c.title)
      .filter((t): t is string => !!t),
  );

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const k of Object.keys(row)) {
      if (skipTitles.has(k)) continue;
      row[k] = escapeCsvFormulaValue(row[k]);
    }
  }
}
