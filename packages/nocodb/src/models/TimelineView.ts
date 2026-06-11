import type { BoolType, MetaType, TimelineType } from 'nocodb-sdk';

export default class TimelineView implements TimelineType {
  fk_view_id: string;
  title: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  meta?: MetaType;
  timeline_range?: any[];
  show?: BoolType;
  public?: BoolType;
  password?: string;
  show_all_fields?: BoolType;

  constructor(data: TimelineView) {
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
