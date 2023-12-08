import type Source from '~/models/Source';
import type Column from '~/models/Column';
import type { ColumnType } from 'nocodb-sdk';
import ModelXcMetaFactory from '~/db/sql-mgr/code/models/xc/ModelXcMetaFactory';

export default function getColumnUiType(
  source: Source,
  column: Column | ColumnType,
) {
  const metaFact = ModelXcMetaFactory.create({ client: source.type }, {});
  return metaFact.getUIDataType(column);
}
