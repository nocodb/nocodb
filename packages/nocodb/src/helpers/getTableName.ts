import inflection from 'inflection';
import type Source from '~/models/Source';

function normalizeForInflection(name: string, source: Source): string {
  if (
    source?.type === 'oracledb' &&
    name === name.toUpperCase() &&
    name !== name.toLowerCase()
  ) {
    return name.toLowerCase();
  }
  return name;
}

export default function getTableNameAlias(
  tableName: string,
  prefix,
  source: Source,
): string {
  let tn = tableName;
  if (source.isMeta(true) && !source.isMeta(true, 1) && prefix) {
    tn = tn.replace(prefix, '');
  }

  return (
    (source?.inflection_table &&
      inflection[source?.inflection_table]?.(
        normalizeForInflection(tn, source),
      )) ||
    tn
  );
}

export function getColumnNameAlias(columnName: string, source: Source): string {
  return (
    (source?.inflection_column &&
      inflection[source?.inflection_column]?.(
        normalizeForInflection(columnName, source),
      )) ||
    columnName
  );
}
