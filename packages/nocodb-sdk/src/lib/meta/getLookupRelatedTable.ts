import {
  IColumnMeta,
  IGetMeta,
  ILinkToAnotherRecordColumn,
  ILookupColumn,
} from '~/lib/types/meta.type';
import { NcContext } from '../ncTypes';
import { getLTARRelatedTable } from './getLTARRelatedTable';
import { getContextFromObject } from './getContextFromObject';
import { getColOptions } from './getColOptions';
import { getColumns } from './getColumns';

export const getLookupRelatedInfo = async (
  context: NcContext,
  {
    colOptions,
    columns,
    getMeta,
  }: { colOptions: ILookupColumn; columns: IColumnMeta[]; getMeta: IGetMeta }
) => {
  let relationCol;
  relationCol = columns.find(
    (col) => col.id === colOptions.fk_relation_column_id
  );
  if (!relationCol && 'getRelationColumn' in colOptions) {
    relationCol = await colOptions.getRelationColumn(context);
  }

  const relatedTable = await getLTARRelatedTable(
    getContextFromObject(relationCol),
    {
      colOptions: await getColOptions<ILinkToAnotherRecordColumn>(
        getContextFromObject(relationCol),
        {
          column: relationCol,
        }
      ),
      getMeta,
    }
  );
  let lookupColumn;
  if ('getLookupColumn' in colOptions) {
    lookupColumn = await colOptions.getLookupColumn(context);
  } else {
    lookupColumn = await getColumns(getContextFromObject(relatedTable), {
      model: relatedTable,
    });
  }

  return {
    relatedTable,
    relationCol,
    lookupColumn,
  };
};
