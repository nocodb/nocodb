import ModelCE from 'src/models/Model';
import type { TableType } from 'nocodb-sdk';
import type { XKnex } from '~/db/CustomKnex';
import View from '~/models/View';
import Source from '~/models/Source';
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
    const source = await Source.get(model.source_id);

    if (!args?.viewId) {
      const view = await View.getDefaultView(model.id, ncMeta);
      args.viewId = view.id;
    }

    if (source && source.isMeta(true, 1)) {
      return new BaseModelSqlv2({
        dbDriver: args.dbDriver,
        viewId: args.viewId,
        model,
        schema: source.getConfig()?.schema,
      });
    }

    return new BaseModelSqlv2({
      dbDriver: args.dbDriver,
      viewId: args.viewId,
      model,
    });
  }
}
