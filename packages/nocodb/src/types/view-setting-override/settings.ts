import { ViewSettingOverrideOptions, ViewTypes } from 'nocodb-sdk';

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

// the above are ts interfaces which do not available at runtime
// so we have another runtime values for available settings
const kanbanAvailableSettings = [
  ViewSettingOverrideOptions.FIELD_VISIBILITY,
  ViewSettingOverrideOptions.FIELD_ORDER,
  ViewSettingOverrideOptions.FILTER_CONDITION,
  ViewSettingOverrideOptions.SORT,
  ViewSettingOverrideOptions.ROW_COLORING,
];
export const viewOverrideAvailableSettings = {
  [ViewTypes.GRID]: [
    ViewSettingOverrideOptions.FIELD_VISIBILITY,
    ViewSettingOverrideOptions.FIELD_ORDER,
    ViewSettingOverrideOptions.COLUMN_WIDTH,
    ViewSettingOverrideOptions.ROW_HEIGHT,
    ViewSettingOverrideOptions.FILTER_CONDITION,
    ViewSettingOverrideOptions.SORT,
    ViewSettingOverrideOptions.GROUP,
    ViewSettingOverrideOptions.ROW_COLORING,
  ],
  [ViewTypes.FORM]: [
    ViewSettingOverrideOptions.FIELD_VISIBILITY,
    ViewSettingOverrideOptions.FIELD_ORDER,
  ],
  [ViewTypes.KANBAN]: kanbanAvailableSettings,
  [ViewTypes.GALLERY]: kanbanAvailableSettings,
  [ViewTypes.CALENDAR]: kanbanAvailableSettings,
};
