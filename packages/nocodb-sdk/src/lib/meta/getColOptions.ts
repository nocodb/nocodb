import { IColumnMeta, IColumnMetaOptions } from '~/lib/types/meta.type';
import { NcContext } from '../ncTypes';

export const getColOptions = async <T extends IColumnMetaOptions>(
  context: NcContext,
  { column }: { column: IColumnMeta }
) => {
  if ('colOptions' in column) {
    return <T>column.colOptions;
  } else if ('getColOptions' in column) {
    return <T>await column.getColOptions(context);
  }
  return <T>undefined;
};
