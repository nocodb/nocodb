import { ViewTypes } from 'nocodb-sdk';
import type { ViewSettingOverrideOptions } from 'nocodb-sdk';

export interface OverrideViewGridSetting {
  [ViewSettingOverrideOptions.FIELD_VISIBILITY]: boolean;
  [ViewSettingOverrideOptions.FIELD_ORDER]: boolean;
  [ViewSettingOverrideOptions.COLUMN_WIDTH]: boolean;
  [ViewSettingOverrideOptions.ROW_HEIGHT]: boolean;
  [ViewSettingOverrideOptions.FILTER_CONDITION]: boolean;
  [ViewSettingOverrideOptions.SORT]: boolean;
  [ViewSettingOverrideOptions.GROUP]: boolean;
  [ViewSettingOverrideOptions.ROW_COLORING]: boolean;
}

export interface OverrideViewKanbanSetting {
  [ViewSettingOverrideOptions.FIELD_VISIBILITY]: boolean;
  [ViewSettingOverrideOptions.FIELD_ORDER]: boolean;
  [ViewSettingOverrideOptions.FILTER_CONDITION]: boolean;
  [ViewSettingOverrideOptions.SORT]: boolean;
  [ViewSettingOverrideOptions.ROW_COLORING]: boolean;
}
export interface OverrideViewGallerySetting extends OverrideViewKanbanSetting {}
export interface OverrideViewCalendarSetting
  extends OverrideViewKanbanSetting {}

export interface OverrideViewFormSetting {
  [ViewSettingOverrideOptions.FIELD_VISIBILITY]: boolean;
  [ViewSettingOverrideOptions.FIELD_ORDER]: boolean;
}
