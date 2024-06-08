import ModelCE from 'src/models/Model';
import type { TableType } from 'nocodb-sdk';
import type { XKnex } from '~/db/CustomKnex';
import type { NcContext } from '~/interface/config';
import { ModelStat, Source, View } from '~/models';
import Noco from '~/Noco';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';

export default class Model extends ModelCE implements TableType {
  public static async getBaseModelSQL(
    context: NcContext,
    args: {
      id?: string;
      viewId?: string;
      dbDriver: XKnex;
      model?: Model;
      extractDefaultView?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<BaseModelSqlv2> {
    const model = args?.model || (await this.get(context, args.id, ncMeta));
    const source = await Source.get(context, model.source_id, false, ncMeta);

    if (!args?.viewId && args.extractDefaultView) {
      const view = await View.getDefaultView(context, model.id, ncMeta);
      args.viewId = view.id;
    }

    if (source && source.isMeta(true, 1)) {
      return new BaseModelSqlv2({
        context,
        dbDriver: args.dbDriver,
        viewId: args.viewId,
        model,
        schema: source.getConfig()?.schema,
      });
    }

    if (source && source.type === 'pg') {
      return new BaseModelSqlv2({
        context,
        dbDriver: args.dbDriver,
        viewId: args.viewId,
        model,
        schema: source.getConfig()?.searchPath?.[0],
      });
    }

    return new BaseModelSqlv2({
      context,
      dbDriver: args.dbDriver,
      viewId: args.viewId,
      model,
    });
  }

  async delete(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    force = false,
  ): Promise<boolean> {
    await ModelStat.delete(context, this.fk_workspace_id, this.id, ncMeta);
    return super.delete(context, ncMeta, force);
  }
}
