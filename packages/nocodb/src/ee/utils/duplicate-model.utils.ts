import { DuplicateModelUtils as DuplicateModelUtilsCE } from 'src/utils/duplicate-model.utils';
import { PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk';
import { UPDATE_WORKSPACE_STAT } from '../services/update-stats.service';
import type { NcContext } from 'nocodb-sdk';
import type { DuplicateModelJobData } from '~/interface/Jobs';
import { getBaseModelSqlFromModelId } from '~/helpers/dbHelpers';
import { checkLimit, getFeature } from '~/ee/helpers/paymentHelpers';
import { NcError } from '~/helpers/ncError';
import { isOnPrem } from '~/utils';
import { ModelStat } from '~/models';
import Noco from '~/Noco';

export class DuplicateModelUtils extends DuplicateModelUtilsCE {
  static get _() {
    return new DuplicateModelUtils();
  }
  override async getTargetContext(
    context: NcContext,
    options?: DuplicateModelJobData['options'],
  ) {
    if (options.targetBaseId && options.targetBaseId != context.base_id) {
      if (
        !(await getFeature(
          PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_BASE,
          context.workspace_id,
        ))
      ) {
        NcError.get(context).featureNotSupported({
          feature: PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_BASE,
          isOnPrem,
        });
      }
      if (options.targetWorkspaceId !== context.workspace_id) {
        if (
          !(await getFeature(
            PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_WS,
            context.workspace_id,
          ))
        ) {
          NcError.get(context).featureNotSupported({
            feature: PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_WS,
            isOnPrem,
          });
        }
      }
      return {
        context: {
          ...context,
          workspace_id: options.targetWorkspaceId,
          base_id: options.targetBaseId,
        },
        isDifferent: true,
      };
    }
    return { context, isDifferent: false };
  }

  override async verifyTargetContext(
    sourceContext: NcContext,
    targetContext: NcContext,
    modelId: string,
    options?: DuplicateModelJobData['options'],
  ): Promise<boolean> {
    if (options.excludeData) {
      return true;
    }
    const baseModel = await getBaseModelSqlFromModelId({
      modelId,
      context: sourceContext,
    });
    const count = await baseModel.count();
    if (count === 0) {
      return true;
    }

    const workspaceStats = await ModelStat.getWorkspaceSum(
      targetContext.workspace_id,
    );

    let workspaceRowCount = workspaceStats ? workspaceStats.row_count : null;

    // initial case
    if (workspaceRowCount === null) {
      Noco.eventEmitter.emit(UPDATE_WORKSPACE_STAT, {
        context: targetContext,
        fk_workspace_id: targetContext.workspace_id,
        force: true,
      });

      workspaceRowCount = 0;
    }

    await checkLimit({
      workspaceId: targetContext.workspace_id,
      type: PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE,
      count: workspaceRowCount,
      delta: count,
      throwError: true,
      message: ({ limit }) =>
        `Only ${limit} records are allowed in target workspace, for more please upgrade your plan`,
    });
  }
}
