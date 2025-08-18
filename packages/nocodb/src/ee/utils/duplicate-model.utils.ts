import { DuplicateModelUtils as DuplicateModelUtilsCE } from 'src/utils/duplicate-model.utils';
import type { NcContext } from 'nocodb-sdk';
import type { DuplicateModelJobData } from '~/interface/Jobs';

export class DuplicateModelUtils extends DuplicateModelUtilsCE {
  static get _() {
    return new DuplicateModelUtils();
  }
  override getTargetContext(
    context: NcContext,
    options?: DuplicateModelJobData['options'],
  ) {
    if (options.targetBaseId && options.targetBaseId != context.base_id) {
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
