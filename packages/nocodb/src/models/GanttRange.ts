import type { GanttRangeType } from 'nocodb-sdk';
import { GanttDependencyDirection } from 'nocodb-sdk';

export default class GanttRange implements GanttRangeType {
  id?: string;
  fk_start_col_id?: string;
  fk_end_col_id?: string;
  fk_dependency_col_id?: string;
  dependency_direction?: GanttDependencyDirection;
  fk_workspace_id?: string;
  base_id?: string;
  fk_view_id?: string;

  constructor(data: Partial<GanttRange>) {
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
