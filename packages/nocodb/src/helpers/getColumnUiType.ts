import { SqlUiFactory } from 'nocodb-sdk';
import type Source from '~/models/Source';
import type Column from '~/models/Column';
import type { ColumnType } from 'nocodb-sdk';

export default function getColumnUiType(
  source: Source,
  column: Column | ColumnType,
) {
  const sqlUi = SqlUiFactory.create({ client: source.type });
  return sqlUi.getMetaUIDataType(column as ColumnType);
}
