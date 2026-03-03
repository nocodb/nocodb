import { UnifiedMetaType } from '~/lib/types';
import { NcContext } from '../ncTypes';

export const getLTARRelatedTable = async (
  context: NcContext,
  {
    colOptions,
    getMeta,
  }: {
    colOptions: UnifiedMetaType.ILinkToAnotherRecordColumn;
    getMeta: UnifiedMetaType.IGetModel;
  }
) => {
  if (!colOptions) {
    return undefined;
  }
  if ('getRelatedTable' in colOptions) {
    return await colOptions.getRelatedTable({
      ...context,
      base_id: colOptions.fk_related_base_id || context.base_id,
    });
  } else {
    return await getMeta(
      {
        ...context,
        base_id: colOptions.fk_related_base_id || context.base_id,
      },
      {
        id: colOptions.fk_related_model_id,
      }
    );
  }
};
