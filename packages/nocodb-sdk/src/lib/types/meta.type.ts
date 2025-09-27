import { ColumnType, LinkToAnotherRecordType } from '~/lib/Api';
import { NcContext } from '~/lib/ncTypes';
import { ParsedFormulaNode } from '../formulaHelpers';

export type IColumnMetaOptions =
  | ILookupColumn
  | ILinkToAnotherRecordColumn
  | IRollupColumn
  | IFormulaColumn;

export type IColumnMeta = ColumnType & {
  base_id: string;
  fk_workspace_id?: string;
  meta?: any;
  getColOptions?: <T extends IColumnMetaOptions>(
    context: NcContext,
    ncMeta?: any
  ) => Promise<T>;
};

export interface IGetMetaResult {
  base_id: string;
  fk_workspace_id?: string;
  id: string;
  title: string;
  columns: IColumnMeta[];
  getColumns?: (context: NcContext) => Promise<IColumnMeta[]>;
}

export interface IGetMeta {
  (context: NcContext, param: { id: string }): Promise<IGetMetaResult>;
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

  getRelatedTable?(context: NcContext, ncMeta?: any): Promise<IGetMetaResult>;
}

export interface ILookupColumn {
  fk_relation_column_id: string;
  fk_lookup_column_id: string;
  fk_column_id: string;

  getRelationColumn?(context: NcContext, ncMeta?: any): Promise<IColumnMeta>;
  getLookupColumn?(context: NcContext, ncMeta?: any): Promise<IColumnMeta>;
}

export interface IRollupColumn {
  id: string;
  base_id?: string;
  fk_workspace_id?: string;
  fk_column_id;
  fk_relation_column_id;
  fk_rollup_column_id;
  rollup_function: string;

  getRelationColumn(context: NcContext, ncMeta?: any): Promise<IColumnMeta>;
  getRollupColumn(context: NcContext, ncMeta?: any): Promise<IColumnMeta>;
}

export interface IFormulaColumn {
  formula: string;
  formula_raw: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_column_id: string;
  error: string;
  parsed_tree?: ParsedFormulaNode;

  getParsedTree(): ParsedFormulaNode;
}
