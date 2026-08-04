// Contracts for the DATETIME_FORMAT strategy. Each SQL dialect provides a
// handler that translates a Day.js format string into the dialect-native
// server-side date formatting expression. See nocodb/nocodb#12545.

// A single segment of a tokenized format string — either a recognised Day.js
// token (`literal: false`) or a run of literal text (`literal: true`).
export interface FormatPart {
  literal: boolean;
  value: string;
}

// Strategy contract: render `dateExpr` (an SQL date/datetime expression) using
// the given Day.js `format`, returning a scalar SQL expression for the dialect.
export interface DatetimeFormatHandler {
  build(dateExpr: string, format: string): string;
}
