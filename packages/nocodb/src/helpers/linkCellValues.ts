import { RelationTypes } from 'nocodb-sdk';

/** Default delimiter for multiple display values in one link cell. */
export const DEFAULT_LINK_DELIMITER = ',';

/** Link types that hold one record. */
export const SINGLE_TARGET_RELATIONS: RelationTypes[] = [
  RelationTypes.BELONGS_TO,
  RelationTypes.MANY_TO_ONE,
  RelationTypes.ONE_TO_ONE,
];

/**
 * Delimiter to split a link cell on, or null to keep it whole. A single-target
 * cell is one display value that may itself contain the default ','
 * ("Acme, Inc."); a custom delimiter still splits.
 */
export function linkCellDelimiter(
  delimiter: string | null,
  isSingleLink: boolean,
): string | null {
  return isSingleLink && delimiter === DEFAULT_LINK_DELIMITER
    ? null
    : delimiter;
}

/** Split a link cell into trimmed, non-empty display values. */
export function splitDisplayValues(
  raw: any,
  delimiter: string | null,
): string[] {
  if (raw === null || raw === undefined) return [];
  const text = String(raw);
  return (delimiter === null ? [text] : text.split(delimiter))
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
