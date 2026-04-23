import type { BoolType, IdType, MetaType, StringOrNullType } from './Api';

export enum GanttDependencyDirection {
  PREDECESSOR = 'predecessor',
  SUCCESSOR = 'successor',
}

export enum GanttZoomLevel {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

/**
 * Extensible config stored in GanttType.meta JSON.
 * Dedicated FK fields live on GanttRangeType for cascade delete.
 */
export interface GanttMetaType {
  use_milestones?: boolean;
  highlight_critical_path?: boolean;
  zoom_level?: GanttZoomLevel;
  fk_color_col_id?: IdType | null;
}

/**
 * Model for Gantt
 */
export interface GanttType {
  id?: IdType;
  fk_view_id?: IdType;
  columns?: GanttColumnType[];
  gantt_range?: GanttRangeType[];
  meta?: MetaType;
  title?: string;
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
 * Model for Gantt Range (start/end date + dependency link)
 */
export interface GanttRangeType {
  fk_view_id?: StringOrNullType;
  fk_start_col_id?: IdType;
  fk_end_col_id?: StringOrNullType;
  fk_dependency_col_id?: StringOrNullType;
  dependency_direction?: GanttDependencyDirection;
  label?: string;
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
  /** Gantt Range */
  gantt_range?: GanttRangeType[];
  /** Meta Info */
  meta?: MetaType;
}
