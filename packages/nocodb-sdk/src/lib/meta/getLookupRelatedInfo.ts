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
  let relationColumn: IColumnMeta;
  relationColumn = columns.find(
    (col) => col.id === colOptions.fk_relation_column_id
  );
  if (!relationColumn && 'getRelationColumn' in colOptions) {
    relationColumn = await colOptions.getRelationColumn(context);
  }

  const relatedTable = await getLTARRelatedTable(
    getContextFromObject(relationColumn),
    {
      colOptions: await getColOptions<ILinkToAnotherRecordColumn>(
        getContextFromObject(relationColumn),
        {
          column: relationColumn,
        }
      ),
      getMeta,
    }
  );
  let lookupColumn: IColumnMeta;
  if ('getLookupColumn' in colOptions) {
    lookupColumn = await colOptions.getLookupColumn(context);
  } else {
    lookupColumn = (
      await getColumns(getContextFromObject(relatedTable), {
        model: relatedTable,
      })
    ).find((col) => col.id === colOptions.fk_lookup_column_id);
  }

  return {
    relatedTable,
    relationColumn,
    lookupColumn,
  };
};
