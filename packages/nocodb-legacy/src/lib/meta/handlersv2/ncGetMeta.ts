import Model from '../../models/Model';
import type { NcContextV2 } from '../NcMetaMgrv2';

export default async function (this: NcContextV2, { args }: any) {
  const meta = await Model.getByIdOrName({
    table_name: args.tn,
    project_id: args.project_id,
    base_id: args.id,
  });
  await meta.getColumns();

  return meta;
}
