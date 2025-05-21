import inflection from 'inflection';
import type Source from '~/models/Source';

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
    (source?.inflection_table && inflection[source?.inflection_table]?.(tn)) ||
    tn
  );
}

export function getColumnNameAlias(columnName: string, source: Source): string {
  return (
    (source?.inflection_column &&
      inflection[source?.inflection_column]?.(columnName)) ||
    columnName
  );
}
