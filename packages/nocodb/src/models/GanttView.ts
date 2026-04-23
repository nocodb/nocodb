import type { BoolType, GanttType, MetaType } from 'nocodb-sdk';

export default class GanttView implements GanttType {
  fk_view_id: string;
  title: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  meta?: MetaType;
  gantt_range?: any[];
  show?: BoolType;
  public?: BoolType;
  password?: string;
  show_all_fields?: BoolType;

  constructor(data: GanttView) {
    Object.assign(this, data);
  }

  public static async get(..._args) {
    return null;
  }

  static async insert(..._args) {
    return null;
  }

  static async update(..._args) {
    return null;
  }
}
