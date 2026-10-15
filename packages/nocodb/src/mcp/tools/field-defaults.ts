import { parseCheckboxValue, UITypes } from 'nocodb-sdk';

const NUMERIC_DEFAULT_TYPES = new Set<string>([
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Rating,
  UITypes.Year,
  UITypes.Duration,
]);

const NUMERIC = /^-?\d+(\.\d+)?$/;

// `cdf` is a text meta column, so the v3 builder hands back Checkbox and
// numeric defaults as strings ("false", "0"). MCP returns them typed; REST v3
// is left as is.
export function typedFieldDefault<T>(field: T): T {
  const { type, default_value: value } =
    (field as { type?: string; default_value?: unknown }) ?? {};

  if (typeof value !== 'string' || !value.trim()) return field;

  if (type === UITypes.Checkbox) {
    const parsed = parseCheckboxValue(value);
    return parsed === null ? field : { ...field, default_value: parsed };
  }

  if (NUMERIC_DEFAULT_TYPES.has(type) && NUMERIC.test(value.trim())) {
    const n = Number(value);
    // Number is bigint-backed on PG: keep an unsafe integer as a string so a
    // read-back write doesn't save a rounded default.
    if (Number.isInteger(n) && !Number.isSafeInteger(n)) return field;
    return { ...field, default_value: n };
  }

  return field;
}

/** A v3 table response with each of its `fields` passed through `typedFieldDefault`. */
export function withTypedFieldDefaults<T>(table: T): T {
  const fields = (table as { fields?: unknown })?.fields;
  if (!Array.isArray(fields)) return table;
  return { ...table, fields: fields.map(typedFieldDefault) };
}
