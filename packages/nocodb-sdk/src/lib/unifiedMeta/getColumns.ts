import { NcContext } from '../ncTypes';
import { UnifiedMetaType } from '../types';

export const getColumns = async (
  _context: NcContext,
  { model }: { model: UnifiedMetaType.IModel }
) => {
  if (!model) {
    return undefined;
  }
  if ('columns' in model && model.columns?.length) {
    return await model.columns;
  } else if ('getColumns' in model) {
    return await model.getColumns();
  }
  return undefined;
};
