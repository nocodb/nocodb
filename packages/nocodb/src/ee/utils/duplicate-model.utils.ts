import { DuplicateModelUtils as DuplicateModelUtilsCE } from 'src/utils/duplicate-model.utils';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { getFeature } from '../helpers/paymentHelpers';
import type { NcContext } from 'nocodb-sdk';
import type { DuplicateModelJobData } from '~/interface/Jobs';
import { NcError } from '~/helpers/ncError';
import { isOnPrem } from '~/utils';

export class DuplicateModelUtils extends DuplicateModelUtilsCE {
  static get _() {
    return new DuplicateModelUtils();
  }
  override getTargetContext(
    context: NcContext,
    options?: DuplicateModelJobData['options'],
  ) {
    if (options.targetBaseId && options.targetBaseId != context.base_id) {
      if (!getFeature(PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_BASE)) {
        NcError.get(context).featureNotSupported({
          feature: PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_BASE,
          isOnPrem,
        });
      }
      if (options.targetWorkspaceId !== context.workspace_id) {
        if (!getFeature(PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_WS)) {
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
}
