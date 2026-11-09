import { UnifiedMetaType } from '~/lib/types';
import { NcContext } from '../ncTypes';
import { getLTARRelatedTable } from './getLTARRelatedTable';
import { getContextFromObject } from './getContextFromObject';
import { getColOptions } from './getColOptions';
import { getColumns } from './getColumns';
import { FormulaError } from '../formula/error';
import { FormulaErrorType } from '../formula/enums';

export const getLookupRelatedInfo = async (
  _context: NcContext,
  {
    colOptions,
    columns,
    getMeta,
  }: {
    colOptions: UnifiedMetaType.ILookupColumn;
    columns: UnifiedMetaType.IColumn[];
    getMeta: UnifiedMetaType.IGetModel;
  }
) => {
  let relationColumn: UnifiedMetaType.IColumn;
  relationColumn = columns.find(
    (col) => col.id === colOptions.fk_relation_column_id
  );
  if (!relationColumn && 'getRelationColumn' in colOptions) {
    relationColumn = await colOptions.getRelationColumn();
  }
  // a dangling link reference: a formula error, which reads as the error
  // value, not a TypeError that fails the whole read
  if (!relationColumn) {
    throw new FormulaError(
      FormulaErrorType.INVALID_COLUMN,
      {
        key: 'msg.formula.columnNotAvailable',
        columnName: colOptions.fk_relation_column_id,
      },
      `Field ${colOptions.fk_relation_column_id} is not available`
    );
  }

  const relatedTable = await getLTARRelatedTable(
    getContextFromObject(relationColumn),
    {
      colOptions:
        await getColOptions<UnifiedMetaType.ILinkToAnotherRecordColumn>(
          getContextFromObject(relationColumn),
          {
            column: relationColumn,
          }
        ),
      getMeta,
    }
  );
  let lookupColumn: UnifiedMetaType.IColumn;
  if ('getLookupColumn' in colOptions) {
    lookupColumn = await colOptions.getLookupColumn();
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
