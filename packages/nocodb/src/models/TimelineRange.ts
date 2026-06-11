import type { TimelineRangeType } from 'nocodb-sdk';

export default class TimelineRange implements TimelineRangeType {
  id?: string;
  fk_from_column_id?: string;
  fk_to_column_id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_view_id?: string;

  constructor(data: Partial<TimelineRange>) {
    Object.assign(this, data);
  }

  public static async bulkInsert(..._args) {
    return false;
  }

  public static async read(..._args) {
    return null;
  }

  public static async delete(..._args) {
    return false;
  }

  public static async find(..._args) {
    return null;
  }

  public static async IsColumnBeingUsedAsRange(..._args) {
    return [];
  }
}
