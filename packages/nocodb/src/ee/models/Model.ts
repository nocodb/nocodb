import ModelCE from 'src/models/Model';
import type { TableType } from 'nocodb-sdk';
import type { XKnex } from '~/db/CustomKnex';
import View from '~/models/View';
import Base from '~/models/Base';
import Noco from '~/Noco';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';

export default class Model extends ModelCE implements TableType {
  public static async getBaseModelSQL(
    args: {
      id?: string;
      viewId?: string;
      dbDriver: XKnex;
      model?: Model;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<BaseModelSqlv2> {
    const model = args?.model || (await this.get(args.id, ncMeta));
    const base = await Base.get(model.base_id);

    if (!args?.viewId) {
      const view = await View.getDefaultView(model.id, ncMeta);
      args.viewId = view.id;
    }

    if (base && base.isMeta(true, 1)) {
      return new BaseModelSqlv2({
        dbDriver: args.dbDriver,
        viewId: args.viewId,
        model,
        schema: base.getConfig()?.schema,
      });
    }

    return new BaseModelSqlv2({
      dbDriver: args.dbDriver,
      viewId: args.viewId,
      model,
    });
  }
}
