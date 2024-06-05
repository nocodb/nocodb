import type { BoolType } from 'nocodb-sdk';
import Model from '~/models/Model';
import Column from '~/models/Column';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { View } from '~/models/index';
import Filter from '~/models/Filter';

export default class LinkToAnotherRecordColumn {
  id: string;
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
  virtual: BoolType = false;

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
    Object.assign(this, data);
  }

  public async getChildColumn(ncMeta = Noco.ncMeta): Promise<Column> {
    return (this.childColumn = await Column.get(
      {
        colId: this.fk_child_column_id,
      },
      ncMeta,
    ));
  }

  public async getMMChildColumn(ncMeta = Noco.ncMeta): Promise<Column> {
    return (this.mmChildColumn = await Column.get(
      {
        colId: this.fk_mm_child_column_id,
      },
      ncMeta,
    ));
  }

  public async getParentColumn(ncMeta = Noco.ncMeta): Promise<Column> {
    return (this.parentColumn = await Column.get(
      {
        colId: this.fk_parent_column_id,
      },
      ncMeta,
    ));
  }
  public async getMMParentColumn(ncMeta = Noco.ncMeta): Promise<Column> {
    return (this.mmParentColumn = await Column.get(
      {
        colId: this.fk_mm_parent_column_id,
      },
      ncMeta,
    ));
  }
  public async getMMModel(ncMeta = Noco.ncMeta): Promise<Model> {
    return (this.mmModel = await Model.getByIdOrName(
      {
        id: this.fk_mm_model_id,
      },
      ncMeta,
    ));
  }
  public async getRelatedTable(ncMeta = Noco.ncMeta): Promise<Model> {
    return (this.relatedTable = await Model.getByIdOrName(
      {
        id: this.fk_related_model_id,
      },
      ncMeta,
    ));
  }

  public static async insert(
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
    await ncMeta.metaInsert2(null, null, MetaTable.COL_RELATIONS, insertObj);
    return this.read(data.fk_column_id, ncMeta);
  }

  async getChildView(ncMeta = Noco.ncMeta) {
    if (!this.fk_target_view_id) return;
    return await View.get(this.fk_target_view_id, ncMeta);
  }

  public static async read(columnId: string, ncMeta = Noco.ncMeta) {
    let colData =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_RELATION}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!colData) {
      colData = await ncMeta.metaGet2(
        null, //,
        null, //model.db_alias
        MetaTable.COL_RELATIONS,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_RELATION}:${columnId}`, colData);
    }
    return colData ? new LinkToAnotherRecordColumn(colData) : null;
  }

  public static async update(
    columnId: string,
    updateBody: Partial<LinkToAnotherRecordColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    if (!columnId) return;
    const updateProps = extractProps(updateBody, ['fk_target_view_id']);
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COL_RELATIONS,
      updateProps,
      { fk_column_id: columnId },
    );

    await NocoCache.update(
      `${CacheScope.COL_RELATION}:${columnId}`,
      updateProps,
    );

    return res;
  }

  public async getFilters(ncMeta = Noco.ncMeta) {
    return (this.filter = (await Filter.getFilterObject(
      {
        linkColId: this.fk_column_id,
      },
      ncMeta,
    )) as any);
  }
}
