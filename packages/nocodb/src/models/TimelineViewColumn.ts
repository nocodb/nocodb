import type { BoolType, MetaType } from 'nocodb-sdk';

export default class TimelineViewColumn {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_view_id?: string;
  fk_column_id?: string;
  source_id?: string;
  show?: BoolType;
  underline?: BoolType;
  bold?: BoolType;
  italic?: BoolType;
  order?: number;
  group_by?: BoolType;
  group_by_order?: number;
  group_by_sort?: string;
  aggregation?: string;
  meta?: MetaType;

  constructor(data: TimelineViewColumn) {
    Object.assign(this, data);
  }

  public static async get(..._args) {
    return null;
  }

  static async insert(..._args) {
    return null;
  }

  public static async list(..._args) {
    return [];
  }

  static async update(..._args) {
    return null;
  }
}
