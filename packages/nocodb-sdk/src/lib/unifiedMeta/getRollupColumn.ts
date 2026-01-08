import { NcContext } from '../ncTypes';
import { UnifiedMetaType } from '../types';
import { getColOptions } from './getColOptions';
import { getColumns } from './getColumns';
import { getLTARRelatedTable } from './getLTARRelatedTable';

export const getRollupColumn = async (
  context: NcContext,
  {
    column,
    columns,
    getMeta,
  }: {
    column: UnifiedMetaType.IColumn;
    columns: UnifiedMetaType.IColumn[];
    getMeta: UnifiedMetaType.IGetModel;
  }
): Promise<UnifiedMetaType.IColumn> => {
  const colOptions = await getColOptions<UnifiedMetaType.IRollupColumn>(
    context,
    { column }
  );
  if ('getRollupColumn' in colOptions) {
    return await colOptions.getRollupColumn(context);
  } else {
    const relationColumn = columns.find(
      (col) =>
        col.id ===
        (colOptions as UnifiedMetaType.IRollupColumn).fk_relation_column_id
    );
    if (!relationColumn) {
      // TODO: better error type
      throw new Error(
        `Relation column not found on column ${column.title}(${column.id})`
      );
    }
    const relationColOptions =
      await getColOptions<UnifiedMetaType.ILinkToAnotherRecordColumn>(context, {
        column: relationColumn,
      });

    const relatedTable = await getLTARRelatedTable(context, {
      colOptions: relationColOptions,
      getMeta,
    });
    const relatedTableColumns = await getColumns(context, {
      model: relatedTable,
    });
    // TODO: possibly throw when column not found on relatedTableColumns
    return relatedTableColumns.find(
      (col) =>
        col.id ===
        (colOptions as UnifiedMetaType.IRollupColumn).fk_rollup_column_id
    );
  }
};
