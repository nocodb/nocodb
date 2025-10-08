import { ViewSettingOverrideOptions } from './enums';
import { ViewTypes } from './globals';
import { ncIsUndefined } from './is';

/**
 * Interface representing a copy view config option with its metadata.
 * Used to define the properties and constraints for each type of view configuration that can be copied.
 */
export interface CopyViewConfigOption {
  /** The display order of this option in the UI */
  order: number;
  /** The human-readable label for this option */
  label: string;
  /** The copy view config type value */
  value: ViewSettingOverrideOptions;
  /** The i18n translation key for the label */
  i18nLabel: string;
  /** Array of view types that support this configuration option */
  supportedViewTypes: ViewTypes[];
  /** IconMapKey */
  icon: string;
  /** Whether this option is disabled */
  disabled?: boolean;
}

/**
 * A comprehensive mapping of all available copy view configuration options.
 *
 * This map defines the metadata and constraints for each type of view configuration that can be copied,
 * including display order, labels, i18n keys, and which view types support each configuration option.
 *
 * @remarks
 * Use this map to:
 * - Get the configuration options available for a specific view type
 * - Determine which view types support a particular configuration option
 * - Access i18n labels and display ordering for UI rendering
 *
 * @example
 * ```ts
 * // Get the field visibility option metadata
 * const fieldVisibilityOption = copyViewConfigOptionMap[ViewSettingOverrideOptions.FIELD_VISIBILITY]
 * // Check if it's supported for grid views
 * const isSupported = fieldVisibilityOption.supportedViewTypes.includes(ViewTypes.GRID)
 * ```
 */
export const copyViewConfigOptionMap: Record<
  ViewSettingOverrideOptions,
  Omit<CopyViewConfigOption, 'disabled'>
> = {
  [ViewSettingOverrideOptions.FIELD_VISIBILITY]: {
    order: 1,
    label: 'Field visibility',
    value: ViewSettingOverrideOptions.FIELD_VISIBILITY,
    i18nLabel: `objects.copyViewConfig.${ViewSettingOverrideOptions.FIELD_VISIBILITY}`,
    supportedViewTypes: [
      ViewTypes.GRID,
      ViewTypes.GALLERY,
      ViewTypes.KANBAN,
      ViewTypes.FORM,
      ViewTypes.CALENDAR,
      ViewTypes.MAP,
    ],
    icon: 'eyeSlash',
  },
  [ViewSettingOverrideOptions.FIELD_ORDER]: {
    order: 2,
    label: 'Field order',
    value: ViewSettingOverrideOptions.FIELD_ORDER,
    i18nLabel: `objects.copyViewConfig.${ViewSettingOverrideOptions.FIELD_ORDER}`,
    supportedViewTypes: [
      ViewTypes.GRID,
      ViewTypes.GALLERY,
      ViewTypes.KANBAN,
      ViewTypes.FORM,
      ViewTypes.CALENDAR,
      ViewTypes.MAP,
    ],
    icon: 'ncNumberList',
  },
  [ViewSettingOverrideOptions.COLUMN_WIDTH]: {
    order: 3,
    label: 'Column width',
    value: ViewSettingOverrideOptions.COLUMN_WIDTH,
    i18nLabel: `objects.copyViewConfig.${ViewSettingOverrideOptions.COLUMN_WIDTH}`,
    supportedViewTypes: [ViewTypes.GRID],
    icon: 'columnWidth',
  },
  [ViewSettingOverrideOptions.ROW_HEIGHT]: {
    order: 4,
    label: 'Row height',
    value: ViewSettingOverrideOptions.ROW_HEIGHT,
    i18nLabel: `objects.copyViewConfig.${ViewSettingOverrideOptions.ROW_HEIGHT}`,
    supportedViewTypes: [ViewTypes.GRID],
    icon: 'rowHeight',
  },
  [ViewSettingOverrideOptions.FILTER_CONDITION]: {
    order: 5,
    label: 'Filter condition',
    value: ViewSettingOverrideOptions.FILTER_CONDITION,
    i18nLabel: `objects.copyViewConfig.${ViewSettingOverrideOptions.FILTER_CONDITION}`,
    supportedViewTypes: [
      ViewTypes.GRID,
      ViewTypes.GALLERY,
      ViewTypes.KANBAN,
      ViewTypes.CALENDAR,
      ViewTypes.MAP,
    ],
    icon: 'filter',
  },
  [ViewSettingOverrideOptions.GROUP]: {
    order: 6,
    label: 'Group',
    value: ViewSettingOverrideOptions.GROUP,
    i18nLabel: `objects.copyViewConfig.${ViewSettingOverrideOptions.GROUP}`,
    supportedViewTypes: [ViewTypes.GRID],
    icon: 'group',
  },
  [ViewSettingOverrideOptions.SORT]: {
    order: 7,
    label: 'Sort',
    value: ViewSettingOverrideOptions.SORT,
    i18nLabel: `objects.copyViewConfig.${ViewSettingOverrideOptions.SORT}`,
    supportedViewTypes: [
      ViewTypes.GRID,
      ViewTypes.GALLERY,
      ViewTypes.KANBAN,
      ViewTypes.CALENDAR,
    ],
    icon: 'sort',
  },
  [ViewSettingOverrideOptions.ROW_COLORING]: {
    order: 8,
    label: 'Row coloring',
    value: ViewSettingOverrideOptions.ROW_COLORING,
    i18nLabel: `objects.copyViewConfig.${ViewSettingOverrideOptions.ROW_COLORING}`,
    supportedViewTypes: [
      ViewTypes.GRID,
      ViewTypes.GALLERY,
      ViewTypes.KANBAN,
      ViewTypes.CALENDAR,
    ],
    icon: 'ncPaintRoller',
  },
};

/**
 * Retrieves all copy view configuration options with their availability status for a specific view type.
 *
 * This function returns all available configuration options, marking each as enabled or disabled
 * based on whether the source view type supports that particular configuration.
 * The returned options are sorted by their display order.
 *
 * @param sourceViewType - The view type from which configurations will be copied
 * @param destinationViewType - The view type to which configurations will be copied
 * @returns An array of supported destination view type configuration options with a 'disabled' flag indicating support status, sorted by order
 */
export const getCopyViewConfigOptions = (
  sourceViewType?: ViewTypes,
  destinationViewType?: ViewTypes
): Omit<CopyViewConfigOption, 'supportedViewTypes'>[] => {
  return Object.values(copyViewConfigOptionMap)
    .filter((option) => {
      if (!destinationViewType) return true;

      return option.supportedViewTypes.includes(destinationViewType);
    })
    .map((option) => {
      const { supportedViewTypes, ...rest } = option;
      return {
        ...rest,
        disabled:
          !ncIsUndefined(sourceViewType) &&
          !supportedViewTypes.includes(sourceViewType),
      };
    })
    .sort((a, b) => a.order - b.order);
};

/**
 * Filters a list of copy view configuration types to only include those supported by the source view type.
 *
 * This function validates each configuration type against the source view type's capabilities,
 * removing any unsupported or invalid configuration types from the list.
 *
 * @param viewSettingOverrideOptions - Array of configuration types to be validated
 * @param sourceViewType - The view type from which configurations will be copied
 * @param destinationViewType - The view type to which configurations will be copied
 * @returns A filtered array containing only the configuration types supported by the source view type and destination view type
 *
 * @example
 * ```ts
 * // Validate selected config types for a Form view
 * const selectedTypes = [ViewSettingOverrideOptions.FIELD_VISIBILITY, ViewSettingOverrideOptions.FILTER_CONDITION, ViewSettingOverrideOptions.GROUP]
 * const supportedTypes = extractSupportedViewSettingOverrideOptions(selectedTypes, ViewTypes.FORM, ViewTypes.GRID)
 * // Result: Only FieldVisibility will be included since destination Grid view support filter and group but source Forms don't support Filters or Groups
 * ```
 */
export const extractSupportedViewSettingOverrideOptions = (
  viewSettingOverrideOptions: ViewSettingOverrideOptions[],
  sourceViewType: ViewTypes,
  destinationViewType?: ViewTypes
) => {
  // extract destination view type options
  const destinationViewTypeOptions = Object.values(
    ViewSettingOverrideOptions
  ).filter((option) => {
    if (!destinationViewType) return true;

    return copyViewConfigOptionMap[option].supportedViewTypes.includes(
      destinationViewType
    );
  });

  // return only options which supported in destination as well as source view type
  return (viewSettingOverrideOptions || []).filter((type) => {
    if (
      !copyViewConfigOptionMap[type] ||
      !destinationViewTypeOptions.includes(type)
    ) {
      return false;
    }

    return copyViewConfigOptionMap[type].supportedViewTypes.includes(
      sourceViewType
    );
  });
};

/**
 * Retrieves all view setting override options supported by a specific view type.
 */
export const getViewSettingOverrideOptionsByViewType = (
  viewType?: ViewTypes
) => {
  return extractSupportedViewSettingOverrideOptions(
    Object.values(ViewSettingOverrideOptions),
    viewType
  );
};
