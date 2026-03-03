import { ColumnType, LinkToAnotherRecordType } from '~/lib/Api';
import { NcContext } from '~/lib/ncTypes';
import { ParsedFormulaNode } from '~/lib/formulaHelpers';
import { RelationTypes } from '~/lib/globals';

/**
 * These types are definitions of meta if it's passed from gui (result from API),
 * or passed from backend (model classes)
 */

export type IColumnOptions =
  | ILookupColumn
  | ILinkToAnotherRecordColumn
  | IRollupColumn
  | IFormulaColumn;

export type IColumn = ColumnType & {
  base_id: string;
  fk_workspace_id?: string;
  meta?: any;
  getColOptions?: <T extends IColumnOptions>(
    context: NcContext,
    ncMeta?: any
  ) => Promise<T>;
};

export interface IModel {
  base_id: string;
  fk_workspace_id?: string;
  id: string;
  title: string;
  columns?: IColumn[];
  getColumns?: (context: NcContext) => Promise<IColumn[]>;
}

export interface IGetModel {
  (context: NcContext, param: { id: string }): Promise<IModel>;
}

export interface ILinkToAnotherRecordColumn extends LinkToAnotherRecordType {
  id: string;

  fk_workspace_id?: string;
  base_id?: string;

  fk_column_id: string;
  fk_child_column_id?: string;
  fk_parent_column_id?: string;
  fk_mm_model_id?: string;
  fk_mm_child_column_id?: string;
  fk_mm_parent_column_id?: string;
  fk_related_model_id?: string;

  // following columns will be only used for cross base link and for normal link, these will be null
  fk_related_base_id?: string;
  fk_mm_base_id?: string;
  fk_related_source_id?: string;
  fk_mm_source_id?: string;

  fk_target_view_id?: string | null;

  dr?: string;
  ur?: string;
  fk_index_name?: string;

  type: 'hm' | 'bt' | 'mm' | 'oo';

  getRelatedTable?(context: NcContext, ncMeta?: any): Promise<IModel>;
}

export interface ILookupColumn {
  fk_relation_column_id: string;
  fk_lookup_column_id: string;
  fk_column_id: string;

  getRelationColumn?(context: NcContext, ncMeta?: any): Promise<IColumn>;
  getLookupColumn?(context: NcContext, ncMeta?: any): Promise<IColumn>;
}

export interface IRollupColumn {
  id: string;
  base_id?: string;
  fk_workspace_id?: string;
  fk_column_id?: string;
  fk_relation_column_id?: string;
  fk_rollup_column_id?: string;
  rollup_function: string;

  getRelationColumn(context: NcContext, ncMeta?: any): Promise<IColumn>;
  getRollupColumn(context: NcContext, ncMeta?: any): Promise<IColumn>;
}

export interface IFormulaColumn {
  formula: string;
  formula_raw: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_column_id: string;
  error: string;
  parsed_tree?: ParsedFormulaNode;

  getParsedTree?(): ParsedFormulaNode;
}

export type ILinkInfo = {
  source: {
    context: NcContext;
    model: IModel;
    linkColumn: IColumn;
    joinColumn: IColumn;
  };
  mm?: {
    context: NcContext;
    sourceJoinColumn: IColumn;
    targetJoinColumn: IColumn;
    model: IModel;
  };
  target: {
    context: NcContext;
    model: IModel;
    linkColumn?: IColumn; // cannot be fetched from relation options
    joinColumn: IColumn;
  };
  relationType: RelationTypes;
  relationFromSource: RelationTypes;
  isBelongsTo: boolean;
};
