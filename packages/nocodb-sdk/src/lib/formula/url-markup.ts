// URL() renders as `URI::( url )` plus an optional ` LABEL::( label )` with
// parentheses escaped; the grid turns it into a link. Same pattern as the
// grid's parser in nc-gui `utils/urlUtils.ts`.
const FORMULA_URI_REGEX =
  /URI::\(((?:[^()]|\\\)|\\\()*[^\\]|)\)(?:\s*LABEL::\(((?:[^()]|\\\)|\\\()*[^\\]|)\))?/g;

/**
 * Replace each URL() link in a formula value with its URL (the label when the
 * URL is empty), so API consumers get plain text instead of the grid markup.
 */
export function unwrapFormulaUrls(value: string): string {
  if (!value.includes('URI::(')) return value;
  return value.replace(FORMULA_URI_REGEX, (_, url = '', label) => {
    const clean = (s: string) => s.trim().replace(/\\([()])/g, '$1');
    return clean(url) || clean(label ?? '');
  });
}
