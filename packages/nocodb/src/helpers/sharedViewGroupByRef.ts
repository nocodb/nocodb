/**
 * Decide whether a shared-view group-by reference is safe to compile.
 *
 * A group-by `column_name` may name SEVERAL columns: the compiler splits it on
 * `,` unconditionally (`BaseModelSqlv2/group-by.ts`) and processes each token on
 * its own, so every token is checked the same way. Checked whole, a
 * comma-joined list resolved to no column and took the caller's
 * unknown-reference allowance — which let every hidden column through.
 *
 * The compiler looks up `subGroupColumnName` whole, so splitting it here is
 * stricter than needed; kept deliberately, as it only rejects more.
 *
 * Kept free of imports so the rule is unit-testable on its own: the helper it
 * needs is passed in, and its real module graph cannot be loaded in isolation.
 */
export function isExposedGroupByRef(
  ref: string | undefined,
  {
    isExposed,
  }: {
    /** Whether a single reference may be compiled. */
    isExposed: (ref?: string) => boolean;
  },
): boolean {
  if (!ref) return true;

  return ref.split(',').every((token) => isExposed(token.trim()));
}
