import { unifiedMeta } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { Column } from '~/models';
import { Model } from '~/models';

export const getLinkInfo = async (
  context: NcContext,
  {
    model,
    column,
  }: {
    model: Model;
    column: Column;
  },
) => {
  return unifiedMeta.getLinkInfo(context, {
    sourceModel: model,
    linkColumn: column,
    getMeta: async (context: NcContext, { id }: { id: string }) =>
      Model.get(context, id),
  });
};
