import ModelCE from 'src/models/Model';
import type { TableType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { DateDependency, ModelStat } from '~/models';
import Noco from '~/Noco';
import ViewSection from '~/ee/models/ViewSection';
import { resolveTrashRetentionDays } from '~/ee/helpers/trashHelpers';

export default class Model extends ModelCE implements TableType {
  get isTrashEnabled(): boolean {
    if (this.synced || this.mm) return false;
    return !this.trash_disabled;
  }

  async isTrashEnabledForWorkspace(context: NcContext): Promise<boolean> {
    if (!this.isTrashEnabled) return false;
    return (
      (await resolveTrashRetentionDays(context, {
        source: 'record',
        model: this,
      })) !== 0
    );
  }

  public static castType(data: Model): Model {
    return data && new Model(data);
  }

  static async softDelete(
    context: NcContext,
    modelId: string,
    deleted: boolean,
    ncMeta = Noco.ncMeta,
  ) {
    await ModelCE.softDelete(context, modelId, deleted, ncMeta);

    // getWorkspaceSum joins on MODELS.deleted — its cached sum is now stale.
    if (context.workspace_id) {
      await ModelStat.invalidateWorkspaceSum(context.workspace_id);
    }
  }

  async delete(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    force = false,
  ): Promise<boolean> {
    await ViewSection.deleteByModelId(context, this.id, ncMeta);
    await DateDependency.deleteByModelId(context, this.id, ncMeta);

    const result = await super.delete(context, ncMeta, force);

    await ModelStat.delete(context, this.fk_workspace_id, this.id, ncMeta);

    return result;
  }
}
