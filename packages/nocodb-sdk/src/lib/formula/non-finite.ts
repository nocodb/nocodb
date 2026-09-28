/**
 * IEEE error values a NUMERIC formula column can carry on a PostgreSQL source.
 *
 * They are strings on the wire rather than JS numbers because JSON cannot
 * represent them — `JSON.stringify(Infinity)` is `null`, which would be
 * indistinguishable from a genuinely blank cell.
 *
 * Only PostgreSQL sources produce these. Other dialects return `null` for a
 * division by zero.
 */
export const FORMULA_NON_FINITE_VALUES = [
  'Infinity',
  '-Infinity',
  'NaN',
] as const;

export type FormulaNonFiniteValue = (typeof FORMULA_NON_FINITE_VALUES)[number];

export function isFormulaNonFiniteValue(
  value: unknown
): value is FormulaNonFiniteValue {
  return (
    typeof value === 'string' &&
    (FORMULA_NON_FINITE_VALUES as readonly string[]).includes(value)
  );
}
