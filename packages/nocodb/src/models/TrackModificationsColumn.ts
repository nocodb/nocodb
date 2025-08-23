import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { Column } from '~/models';
import { MetaTable } from '~/utils/globals';

export default class TrackModificationsColumn {
  id: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_column_id: string;
  fk_trigger_column_id: string;
  
  // Virtual properties
  triggerColumn?: Column;
  trackColumn?: Column;

  constructor(data: Partial<TrackModificationsColumn>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    data: { fk_column_id: string; triggerColumns: string[] },
    ncMeta = Noco.ncMeta,
  ): Promise<TrackModificationsColumn[]> {
    const { fk_column_id, triggerColumns } = data;
    
    // Get the track column to get workspace and base info
    const trackColumn = await Column.get(context, { colId: fk_column_id });
    if (!trackColumn) {
      throw new Error('Track column not found');
    }
    
    const results = [];
    
    // Insert each trigger column relationship
    for (const triggerColId of triggerColumns) {
      const id = await ncMeta.metaInsert2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_TRACK_MODIFICATIONS_TRIGGER_COLUMNS,
        {
          fk_column_id,
          fk_trigger_column_id: triggerColId,
          fk_workspace_id: trackColumn.fk_workspace_id,
          base_id: trackColumn.base_id,
        },
      );

      const record = await this.get(context, { id }, ncMeta);
      if (record) results.push(record);
    }

    return results;
  }

  public static async get(
    context: NcContext,
    { id }: { id: string },
    ncMeta = Noco.ncMeta,
  ): Promise<TrackModificationsColumn> {
    const record = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_TRACK_MODIFICATIONS_TRIGGER_COLUMNS,
      id,
    );

    if (!record) return null;

    // Get the trigger column object
    const triggerColumn = await Column.get(context, { colId: record.fk_trigger_column_id });
    
    // Get the track column object
    const trackColumn = await Column.get(context, { colId: record.fk_column_id });

    return new TrackModificationsColumn({
      ...record,
      triggerColumn,
      trackColumn,
    });
  }

  public static async delete(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_TRACK_MODIFICATIONS_TRIGGER_COLUMNS,
      id,
    );
  }

  public static async list(
    context: NcContext,
    filter: { condition?: { [key: string]: any } },
    ncMeta = Noco.ncMeta,
  ): Promise<TrackModificationsColumn[]> {
    const records = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_TRACK_MODIFICATIONS_TRIGGER_COLUMNS,
      filter,
    );

    return Promise.all(
      records.map(record => this.get(context, { id: record.id }, ncMeta))
    );
  }

  public static async getByColumnId(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TrackModificationsColumn[]> {
    const records = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_TRACK_MODIFICATIONS_TRIGGER_COLUMNS,
      {
        condition: { fk_column_id: columnId },
      },
    );

    return Promise.all(
      records.map(record => this.get(context, { id: record.id }, ncMeta))
    );
  }

  public static async getByTriggerColumnId(
    context: NcContext,
    triggerColumnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TrackModificationsColumn[]> {
    const records = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_TRACK_MODIFICATIONS_TRIGGER_COLUMNS,
      {
        condition: { fk_trigger_column_id: triggerColumnId },
      },
    );

    return Promise.all(
      records.map(record => this.get(context, { id: record.id }, ncMeta))
    );
  }

  // Helper method to check if a column is a trigger for a specific track column
  public static async isTriggerColumn(
    context: NcContext,
    trackColumnId: string,
    triggerColumnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const records = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      'nc_col_track_modifications_trigger_columns',
      {
        condition: { 
          fk_column_id: trackColumnId,
          fk_trigger_column_id: triggerColumnId 
        },
      },
    );

    return records.length > 0;
  }

  // Helper method to add a trigger column
  public static async addTriggerColumn(
    context: NcContext,
    trackColumnId: string,
    triggerColumnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TrackModificationsColumn> {
    // Check if already exists
    const existing = await this.isTriggerColumn(context, trackColumnId, triggerColumnId, ncMeta);
    if (existing) {
      throw new Error('Trigger column relationship already exists');
    }

    // Get the track column to get workspace and base info
    const trackColumn = await Column.get(context, { colId: trackColumnId });
    if (!trackColumn) {
      throw new Error('Track column not found');
    }

    const id = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_TRACK_MODIFICATIONS_TRIGGER_COLUMNS,
      {
        fk_column_id: trackColumnId,
        fk_trigger_column_id: triggerColumnId,
        fk_workspace_id: trackColumn.fk_workspace_id,
        base_id: trackColumn.base_id,
      },
    );

    return this.get(context, { id }, ncMeta);
  }

  // Helper method to remove a trigger column
  public static async removeTriggerColumn(
    context: NcContext,
    trackColumnId: string,
    triggerColumnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const records = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      'nc_col_track_modifications_trigger_columns',
      {
        condition: { 
          fk_column_id: trackColumnId,
          fk_trigger_column_id: triggerColumnId 
        },
      },
    );

    if (records.length === 0) {
      throw new Error('Trigger column relationship not found');
    }

    // Delete the relationship
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_TRACK_MODIFICATIONS_TRIGGER_COLUMNS,
      records[0].id,
    );
  }

  // Helper method to get all trigger columns for a track column
  public static async getTriggerColumns(
    context: NcContext,
    trackColumnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Column[]> {
    const records = await this.getByColumnId(context, trackColumnId, ncMeta);
    return records.map(record => record.triggerColumn).filter(Boolean);
  }

  // Helper method to get all track columns for a trigger column
  public static async getTrackColumns(
    context: NcContext,
    triggerColumnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Column[]> {
    const records = await this.getByTriggerColumnId(context, triggerColumnId, ncMeta);
    return records.map(record => record.trackColumn).filter(Boolean);
  }

  // Helper method to get trigger column IDs for a track column
  public static async getTriggerColumnIds(
    context: NcContext,
    trackColumnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<string[]> {
    const records = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_TRACK_MODIFICATIONS_TRIGGER_COLUMNS,
      {
        condition: { fk_column_id: trackColumnId },
      },
    );

    return records.map(record => record.fk_trigger_column_id);
  }
}
