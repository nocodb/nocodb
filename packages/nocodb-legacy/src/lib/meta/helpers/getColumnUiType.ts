import ModelXcMetaFactory from '../../db/sql-mgr/code/models/xc/ModelXcMetaFactory';
import type Base from '../../models/Base';
import type Column from '../../models/Column';
import type { ColumnType } from 'nocodb-sdk';

export default function getColumnUiType(
  base: Base,
  column: Column | ColumnType
) {
  const metaFact = ModelXcMetaFactory.create({ client: base.type }, {});
  return metaFact.getUIDataType(column);
}
