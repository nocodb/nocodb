import ModelCE from 'src/models/Model';
import type { TableType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { DateDependency, ModelStat } from '~/models';
import Noco from '~/Noco';
import ViewSection from '~/ee/models/ViewSection';
import { resolveTrashRetentionDays } from '~/ee/helpers/trashHelpers';

export default class Model extends ModelCE implements TableType {
  get isTrashEnabled(): boolean {
    return !this.trash_disabled;
  }

  /**
   * Combines per-table `trash_disabled` with the workspace's plan-level
   * retention. Plan retention `0` disables trash for the whole workspace
   * (on-prem Free), so soft-delete falls back to hard-delete.
   */
  override async isTrashEnabledForWorkspace(
    context: NcContext,
  ): Promise<boolean> {
    if (!this.isTrashEnabled) return false;
    const retentionDays = await resolveTrashRetentionDays(context);
    return retentionDays > 0;
  }

  public static castType(data: Model): Model {
    return data && new Model(data);
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
