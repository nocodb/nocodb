import { NcContext } from '../ncTypes';
import { UnifiedMetaType } from '../types';

export const getColOptions = async <T extends UnifiedMetaType.IColumnOptions>(
  context: NcContext,
  { column }: { column: UnifiedMetaType.IColumn }
) => {
  if ('colOptions' in column) {
    return <T>column.colOptions;
  } else if ('getColOptions' in column) {
    return <T>await column.getColOptions(context);
  }
  return <T>undefined;
};
