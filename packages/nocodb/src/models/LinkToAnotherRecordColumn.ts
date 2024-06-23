import type { BoolType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type Filter from '~/models/Filter';
import Model from '~/models/Model';
import Column from '~/models/Column';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { View } from '~/models/index';

export default class LinkToAnotherRecordColumn {
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

  fk_target_view_id?: string | null;

  dr?: string;
  ur?: string;
  fk_index_name?: string;

  type: 'hm' | 'bt' | 'mm' | 'oo';
  virtual: BoolType;

  mmModel?: Model;
  relatedTable?: Model;
  // childModel?: Model;
  // parentModel?: Model;
  mmChildColumn?: Column;
  mmParentColumn?: Column;
  childColumn?: Column;
  parentColumn?: Column;

  filter?: Filter;

  constructor(data: Partial<LinkToAnotherRecordColumn>) {
    Object.assign(this, {
      virtual: false,
      ...data,
    });
  }

  public async getChildColumn(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Column> {
    return (this.childColumn = await Column.get(
      context,
      {
        colId: this.fk_child_column_id,
      },
      ncMeta,
    ));
  }

  public async getMMChildColumn(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Column> {
    return (this.mmChildColumn = await Column.get(
      context,
      {
        colId: this.fk_mm_child_column_id,
      },
      ncMeta,
    ));
  }

  public async getParentColumn(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Column> {
    return (this.parentColumn = await Column.get(
      context,
      {
        colId: this.fk_parent_column_id,
      },
      ncMeta,
    ));
  }
  public async getMMParentColumn(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Column> {
    return (this.mmParentColumn = await Column.get(
      context,
      {
        colId: this.fk_mm_parent_column_id,
      },
      ncMeta,
    ));
  }
  public async getMMModel(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    return (this.mmModel = await Model.getByIdOrName(
      context,
      {
        id: this.fk_mm_model_id,
      },
      ncMeta,
    ));
  }
  public async getRelatedTable(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    return (this.relatedTable = await Model.getByIdOrName(
      context,
      {
        id: this.fk_related_model_id,
      },
      ncMeta,
    ));
  }

  public static async insert(
    context: NcContext,
    data: Partial<LinkToAnotherRecordColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(data, [
      'fk_column_id',
      'type',
      'fk_child_column_id',
      'fk_parent_column_id',
      'fk_mm_model_id',
      'fk_mm_child_column_id',
      'fk_mm_parent_column_id',
      'fk_target_view_id',
      'ur',
      'dr',
      'fk_index_name',
      'fk_related_model_id',
      'virtual',
    ]);

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_RELATIONS,
      insertObj,
    );
    return this.read(context, data.fk_column_id, ncMeta);
  }

  async getChildView(context: NcContext, ncMeta = Noco.ncMeta) {
    if (!this.fk_target_view_id) return;
    return await View.get(context, this.fk_target_view_id, ncMeta);
  }

  public static async read(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let colData =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_RELATION}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!colData) {
      colData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_RELATIONS,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_RELATION}:${columnId}`, colData);
    }
    return colData ? new LinkToAnotherRecordColumn(colData) : null;
  }

  static async update(
    _context: NcContext,
    _fk_column_id: string,
    _param: { fk_target_view_id: string | null },
  ) {
    // placeholder method
  }
}
