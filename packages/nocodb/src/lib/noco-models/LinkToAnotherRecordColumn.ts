import Noco from '../../lib/noco/Noco';
import Column from './Column';
import Model from './Model';
// import NocoCache from '../noco-cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import NocoCache from '../noco-cache/NocoCache';

export default class LinkToAnotherRecordColumn {
  fk_column_id?: string;
  fk_child_column_id?: string;
  fk_parent_column_id?: string;
  fk_mm_model_id?: string;
  fk_mm_child_column_id?: string;
  fk_mm_parent_column_id?: string;
  fk_related_model_id?: string;

  dr?: string;
  ur?: string;
  fk_index_name?: string;

  type: 'hm' | 'bt' | 'mm';
  virtual = false;

  mmModel?: Model;
  relatedTable?: Model;
  // childModel?: Model;
  // parentModel?: Model;
  mmChildColumn?: Column;
  mmParentColumn?: Column;
  childColumn?: Column;
  parentColumn?: Column;

  constructor(data: Partial<LinkToAnotherRecordColumn>) {
    Object.assign(this, data);
  }

  public async getChildColumn(ncMeta = Noco.ncMeta): Promise<Column> {
    return (this.childColumn = await Column.get(
      {
        colId: this.fk_child_column_id
      },
      ncMeta
    ));
  }

  public async getMMChildColumn(ncMeta = Noco.ncMeta): Promise<Column> {
    return (this.mmChildColumn = await Column.get(
      {
        colId: this.fk_mm_child_column_id
      },
      ncMeta
    ));
  }

  public async getParentColumn(ncMeta = Noco.ncMeta): Promise<Column> {
    return (this.parentColumn = await Column.get(
      {
        colId: this.fk_parent_column_id
      },
      ncMeta
    ));
  }
  public async getMMParentColumn(ncMeta = Noco.ncMeta): Promise<Column> {
    return (this.mmParentColumn = await Column.get(
      {
        colId: this.fk_mm_parent_column_id
      },
      ncMeta
    ));
  }
  public async getMMModel(ncMeta = Noco.ncMeta): Promise<Model> {
    return (this.mmModel = await Model.getByIdOrName(
      {
        id: this.fk_mm_model_id
      },
      ncMeta
    ));
  }
  public async getRelatedTable(ncMeta = Noco.ncMeta): Promise<Model> {
    return (this.relatedTable = await Model.getByIdOrName(
      {
        id: this.fk_related_model_id
      },
      ncMeta
    ));
  }

  public static async insert(
    data: Partial<LinkToAnotherRecordColumn>,
    ncMeta = Noco.ncMeta
  ) {
    await ncMeta.metaInsert2(null, null, MetaTable.COL_RELATIONS, {
      fk_column_id: data.fk_column_id,

      // ref_db_alias
      type: data.type,
      // db_type:

      fk_child_column_id: data.fk_child_column_id,
      fk_parent_column_id: data.fk_parent_column_id,

      fk_mm_model_id: data.fk_mm_model_id,
      fk_mm_child_column_id: data.fk_mm_child_column_id,
      fk_mm_parent_column_id: data.fk_mm_parent_column_id,

      ur: data.ur,
      dr: data.dr,

      fk_index_name: data.fk_index_name,
      fk_related_model_id: data.fk_related_model_id
    });
    return this.read(data.fk_column_id, ncMeta);
  }

  public static async read(columnId: string, ncMeta = Noco.ncMeta) {
    let colData =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_RELATION}:${columnId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!colData) {
      colData = await ncMeta.metaGet2(
        null, //,
        null, //model.db_alias
        MetaTable.COL_RELATIONS,
        { fk_column_id: columnId }
      );
      await NocoCache.set(`${CacheScope.COL_RELATION}:${columnId}`, colData);
    }
    return colData ? new LinkToAnotherRecordColumn(colData) : null;
  }

  id: string;
}
