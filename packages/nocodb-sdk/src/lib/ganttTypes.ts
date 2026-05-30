import type {
  BoolType,
  DateDependencyType,
  IdType,
  MetaType,
  StringOrNullType,
} from './Api';

/**
 * Model for Gantt
 */
export interface GanttType {
  id?: IdType;
  fk_view_id?: IdType;
  columns?: GanttColumnType[];
  meta?: MetaType;
  title?: string;
  // The view-owned DateDependency rule (eagerly loaded by GanttView.get).
  // null when the Gantt view doesn't have its own rule yet — the frontend
  // store then falls back to the table-level default rule (table.date_dependency).
  date_dependency?: DateDependencyType | null;
}

/**
 * Model for Gantt Column
 */
export interface GanttColumnType {
  id?: IdType;
  fk_column_id?: IdType;
  fk_view_id?: IdType;
  source_id?: IdType;
  base_id?: IdType;
  title?: string;
  show?: BoolType;
  bold?: BoolType;
  italic?: BoolType;
  underline?: BoolType;
  order?: number;
  group_by?: BoolType;
  group_by_order?: number;
  group_by_sort?: StringOrNullType;
  aggregation?: StringOrNullType;
}

/**
 * Model for Gantt Update Request
 */
export interface GanttUpdateReqType {
  /**
   * Gantt Title
   * @example Gantt 01
   */
  title?: string;
  /** Meta Info */
  meta?: MetaType;
}
