import { UITypes } from 'nocodb-sdk';
import Column from '../../models/Column';
import type { NcContextV2 } from '../NcMetaMgrv2';

export default async function (this: NcContextV2, { args }: any) {
  if (
    !(
      args?._cn &&
      args?.fk_model_id &&
      args?.fk_lookup_column_id &&
      args?.fk_lookup_column_id
    )
  ) {
    throw Error('Missing property');
  }

  return await Column.insert({
    ...args,
    project_id: this.projectId,
    db_alias: this.dbAlias,
    uidt: UITypes.Lookup,
  });
}
