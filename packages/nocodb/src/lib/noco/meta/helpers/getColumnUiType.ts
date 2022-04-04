import Base from '../../../noco-models/Base';
import Column from '../../../noco-models/Column';
import { ColumnType } from 'nocodb-sdk';
import ModelXcMetaFactory from '../../../sqlMgr/code/models/xc/ModelXcMetaFactory';

export default function getColumnUiType(
  base: Base,
  column: Column | ColumnType
) {
  const metaFact = ModelXcMetaFactory.create({ client: base.type }, {});
  return metaFact.getUIDataType(column);
}
