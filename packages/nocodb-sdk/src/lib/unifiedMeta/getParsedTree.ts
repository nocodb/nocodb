import { UnifiedMetaType } from '~/lib/types';
import { NcContext } from '../ncTypes';

export const getParsedTree = async (
  _context: NcContext,
  {
    colOptions,
  }: {
    colOptions: UnifiedMetaType.IFormulaColumn;
    getMeta: UnifiedMetaType.IGetModel;
  }
) => {
  if (!colOptions) {
    return undefined;
  }
  if ('getParsedTree' in colOptions) {
    return colOptions.getParsedTree();
  } else {
    return colOptions.parsed_tree;
  }
};
