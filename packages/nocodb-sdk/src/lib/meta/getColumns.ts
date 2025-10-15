import { IGetMetaResult } from '~/lib/types/meta.type';
import { NcContext } from '../ncTypes';

export const getColumns = async (
  context: NcContext,
  { model }: { model: IGetMetaResult }
) => {
  if ('getColumns' in model) {
    return await model.getColumns(context);
  } else if ('columns' in model) {
    return await model.columns;
  }
  return undefined;
};
