import {
  IColumnMeta,
  IFormulaColumn,
  IGetMeta,
  ILinkToAnotherRecordColumn,
  ILookupColumn,
} from '~/lib/types/meta.type';
import UITypes from '../UITypes';

export const isLtarArray = async ({ col }: { col: IColumnMeta }) => {
  const context = {
    base_id: col.base_id,
    workspace_id: col.fk_workspace_id,
  };
  const lookupColOption = await col.getColOptions<ILinkToAnotherRecordColumn>(
    context
  );
  return { isDataArray: ['hm', 'mm'].includes(lookupColOption.type) };
};

export const isLookupArray = async ({
  col,
  getMeta,
}: {
  col: IColumnMeta;
  getMeta: IGetMeta;
}) => {
  const context = {
    base_id: col.base_id,
    workspace_id: col.fk_workspace_id,
  };
  const lookupColOption = await col.getColOptions<ILookupColumn>(context);
  const relationColumn = await lookupColOption.getRelationColumn(context);
  const { isDataArray } = await isLtarArray({
    col: relationColumn,
  });
  if (isDataArray) {
    return { isDataArray };
  }
  const lookupColumn = await lookupColOption.getLookupColumn(context);
  switch (lookupColumn.uidt) {
    case UITypes.LinkToAnotherRecord: {
      return await isLtarArray({
        col: lookupColumn,
      });
    }
    case UITypes.Formula: {
      return await isFormulaArray({
        col: lookupColumn,
      });
    }

    case UITypes.Lookup: {
      return await isLookupArray({
        col: lookupColumn,
        getMeta,
      });
    }

    default: {
      return { isDataArray: false };
    }
  }
};

export const isFormulaArray = async ({ col }: { col: IColumnMeta }) => {
  const formulaColOptions = await col.getColOptions<IFormulaColumn>({
    base_id: col.base_id,
    workspace_id: col.fk_workspace_id,
  });
  const parsedTree =
    formulaColOptions.parsed_tree ?? formulaColOptions.getParsedTree();
  return { isDataArray: parsedTree.isDataArray };
};
