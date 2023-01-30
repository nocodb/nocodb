import inflection from 'inflection';
import Base from '../../models/Base';

export default function getTableNameAlias(
  tableName: string,
  prefix,
  base: Base
): string {
  let tn = tableName;
  if (base.is_meta && prefix) {
    tn = tn.replace(prefix, '');
  }

  return (
    (base?.inflection_table && inflection[base?.inflection_table]?.(tn)) || tn
  );
}

export function getColumnNameAlias(columnName: string, base: Base): string {
  return (
    (base?.inflection_column &&
      inflection[base?.inflection_column]?.(columnName)) ||
    columnName
  );
}
