import { IGetMeta, ILinkToAnotherRecordColumn } from '~/lib/types/meta.type';
import { NcContext } from '../ncTypes';

export const getLTARRelatedTable = async (
  context: NcContext,
  {
    colOptions,
    getMeta,
  }: { colOptions: ILinkToAnotherRecordColumn; getMeta: IGetMeta }
) => {
  if ('getRelatedTable' in colOptions) {
    return await colOptions.getRelatedTable(context);
  } else {
    return await getMeta(context, {
      id: colOptions.fk_related_model_id,
    });
  }
};
