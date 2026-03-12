import type { BoolType, IdType, MetaType, StringOrNullType } from './Api';

/**
 * Model for Timeline
 */
export interface TimelineType {
  id?: IdType;
  fk_view_id?: IdType;
  columns?: TimelineColumnType[];
  timeline_range?: TimelineRangeType[];
  meta?: MetaType;
  title?: string;
}

/**
 * Model for Timeline Column
 */
export interface TimelineColumnType {
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
 * Model for Timeline Range
 */
export interface TimelineRangeType {
  fk_from_column_id?: IdType;
  fk_to_column_id?: StringOrNullType;
  fk_view_id?: StringOrNullType;
  label?: string;
}

/**
 * Model for Timeline Update Request
 */
export interface TimelineUpdateReqType {
  /**
   * Timeline Title
   * @example Timeline 01
   */
  title?: string;
  /** Timeline Range */
  timeline_range?: TimelineRangeType[];
  /** Meta Info */
  meta?: MetaType;
}
