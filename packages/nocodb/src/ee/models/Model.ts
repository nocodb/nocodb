import ModelCE from 'src/models/Model';
import type { TableType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { ModelStat } from '~/models';
import Noco from '~/Noco';

export default class Model extends ModelCE implements TableType {
  public static castType(data: Model): Model {
    return data && new Model(data);
  }

  async delete(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    force = false,
  ): Promise<boolean> {
    const result = await super.delete(context, ncMeta, force);

    await ModelStat.delete(context, this.fk_workspace_id, this.id, ncMeta);

    return result;
  }
}
