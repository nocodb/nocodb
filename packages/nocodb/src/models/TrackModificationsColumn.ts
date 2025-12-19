import type { BoolType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type Filter from '~/models/Filter';
import Model from '~/models/Model';
import Column from '~/models/Column';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class TrackModificationsColumn {
  id: string;

  fk_workspace_id?: string;
  base_id?: string;

  fk_column_id: string;

  // Configuration for tracking modifications
  enabled: BoolType;
  triggerColumns: string[]; // Array of column IDs that trigger updates
  updateType: 'timestamp' | 'user' | 'custom';
  customValue?: string; // For custom update values

  // Optional: specific table/view context
  fk_target_view_id?: string | null;

  // Cache for related columns
  triggerColumnObjects?: Column[];

  constructor(data: Partial<TrackModificationsColumn>) {
    Object.assign(this, {
      enabled: false,
      triggerColumns: [],
      updateType: 'timestamp',
      ...data,
    });
  }

  public async getTriggerColumns(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Column[]> {
    if (this.triggerColumnObjects) {
      return this.triggerColumnObjects;
    }

    const columns = [];
    for (const colId of this.triggerColumns) {
      try {
        const column = await Column.get(context, { colId }, ncMeta);
        columns.push(column);
      } catch (error) {
        console.warn(`Trigger column ${colId} not found:`, error);
      }
    }

    this.triggerColumnObjects = columns;
    return columns;
  }

  public async getTargetView(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Model | null> {
    if (!this.fk_target_view_id) return null;

    try {
      return await Model.get(context, this.fk_target_view_id, ncMeta);
    } catch (error) {
      console.warn(`Target view ${this.fk_target_view_id} not found:`, error);
      return null;
    }
  }

  public static async insert(
    context: NcContext,
    column: Partial<TrackModificationsColumn>,
    ncMeta = Noco.ncMeta,
  ): Promise<TrackModificationsColumn> {
    const insertObj = extractProps(column, [
      'id',
      'fk_workspace_id',
      'base_id',
      'fk_column_id',
      'enabled',
      'triggerColumns',
      'updateType',
      'customValue',
      'fk_target_view_id',
    ]);

    const { insertId } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_TRACK_MODIFICATIONS,
      insertObj,
    );

    return this.get(context, insertId, ncMeta);
  }

  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TrackModificationsColumn> {
    let data =
      id &&
      (await NocoCache.get(
        `${CacheScope.COL_TRACK_MODIFICATIONS}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!data) {
      data = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_TRACK_MODIFICATIONS,
        id,
      );
      if (data) {
        await NocoCache.set(
          `${CacheScope.COL_TRACK_MODIFICATIONS}:${id}`,
          data,
        );
      }
    }

    return data && new TrackModificationsColumn(data);
  }

  public static async update(
    context: NcContext,
    id: string,
    column: Partial<TrackModificationsColumn>,
    ncMeta = Noco.ncMeta,
  ): Promise<TrackModificationsColumn> {
    const updateObj = extractProps(column, [
      'enabled',
      'triggerColumns',
      'updateType',
      'customValue',
      'fk_target_view_id',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_TRACK_MODIFICATIONS,
      updateObj,
      id,
    );

    await NocoCache.del(`${CacheScope.COL_TRACK_MODIFICATIONS}:${id}`);

    return this.get(context, id, ncMeta);
  }

  public static async delete(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_TRACK_MODIFICATIONS,
      id,
    );

    await NocoCache.del(`${CacheScope.COL_TRACK_MODIFICATIONS}:${id}`);
  }

  public static async list(
    context: NcContext,
    filter: { condition?: { [key: string]: any } },
    ncMeta = Noco.ncMeta,
  ): Promise<TrackModificationsColumn[]> {
    const list = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_TRACK_MODIFICATIONS,
      filter,
    );

    return list.map((item) => new TrackModificationsColumn(item));
  }
}
