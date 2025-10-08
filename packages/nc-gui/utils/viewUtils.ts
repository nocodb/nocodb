import { type RowColoringInfo, ViewTypes } from 'nocodb-sdk'
import { iconMap } from './iconUtils'
import type { Language } from '~/lib/types'
import UsersIcon from '~icons/nc-icons/users'
import LockIcon from '~icons/nc-icons-v2/lock'
import PersonalIcon from '~icons/nc-icons/personal'

export const viewIcons: Record<number | string, { icon: any; color: string }> = {
  [ViewTypes.GRID]: { icon: iconMap.grid, color: '#36BFFF' },
  [ViewTypes.FORM]: { icon: iconMap.form, color: '#7D26CD' },
  [ViewTypes.CALENDAR]: { icon: iconMap.calendar, color: '#B33771' },
  [ViewTypes.GALLERY]: { icon: iconMap.gallery, color: '#FC3AC6' },
  [ViewTypes.MAP]: { icon: iconMap.map, color: 'blue' },
  [ViewTypes.KANBAN]: { icon: iconMap.kanban, color: '#FF9052' },
  view: { icon: iconMap.view, color: 'blue' },
}

export const isRtlLang = (lang: keyof typeof Language) => ['fa', 'ar'].includes(lang)

const rtl = 'rtl' as const
const ltr = 'ltr' as const

export function applyLanguageDirection(dir: typeof rtl | typeof ltr) {
  const oppositeDirection = dir === ltr ? rtl : ltr

  document.body.classList.remove(oppositeDirection)
  document.body.classList.add(dir)
  document.body.style.direction = dir
}

export const getViewIcon = (key?: string | number) => {
  if (!key) return

  return viewIcons[key]
}

export function applyNonSelectable() {
  document.body.classList.add('non-selectable')
}

export const viewLockIcons = {
  [LockType.Personal]: {
    title: 'title.personal',
    icon: PersonalIcon,
    subtitle: 'msg.info.personalView',
  },
  [LockType.Collaborative]: {
    title: 'title.collaborative',
    icon: UsersIcon,
    subtitle: 'msg.info.collabView',
  },
  [LockType.Locked]: {
    title: 'title.locked',
    icon: LockIcon,
    subtitle: 'msg.info.lockedView',
  },
}

export const defaultRowColorInfo: RowColoringInfo = {
  mode: null,
  conditions: [],
  fk_column_id: null,
  color: null,
  is_set_as_background: null,
}

export const getDefaultViewMetas = (viewType: ViewTypes) => {
  switch (viewType) {
    case ViewTypes.FORM:
      return {
        submit_another_form: false,
        show_blank_form: false,
        meta: {
          hide_branding: false,
          background_color: '#F9F9FA',
          hide_banner: false,
        },
      }
  }
  return {}
}

/**
 * Enum representing the different types of view configurations that can be copied from one view to another.
 * Each type corresponds to a specific aspect of a view's configuration.
 */
export enum CopyViewConfigType {
  /** Field visibility settings */
  FieldVisibility = 'fieldVisibility',
  /** Field ordering configuration */
  FieldOrder = 'fieldOrder',
  /** Column width and row height settings */
  ColumnWidthAndRowHeight = 'columnWidthAndRowHeight',
  /** Row height settings */
  RowHeight = 'rowHeight',
  /** Filter configurations */
  Filters = 'filters',
  /** Grouping configurations */
  Groups = 'groups',
  /** Sort configurations */
  Sorts = 'sorts',
  /** Row coloring settings */
  RowColoring = 'rowColoring',
}

/**
 * Interface representing a copy view config option with its metadata.
 * Used to define the properties and constraints for each type of view configuration that can be copied.
 */
export interface CopyViewConfigOption {
  /** The display order of this option in the UI */
  order: number
  /** The human-readable label for this option */
  label: string
  /** The copy view config type value */
  value: CopyViewConfigType
  /** The i18n translation key for the label */
  i18nLabel: string
  /** Array of view types that support this configuration option */
  supportedViewTypes: ViewTypes[]
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
 * const fieldVisibilityOption = copyViewConfigOptionMap[CopyViewConfigType.FieldVisibility]
 * // Check if it's supported for grid views
 * const isSupported = fieldVisibilityOption.supportedViewTypes.includes(ViewTypes.GRID)
 * ```
 */
export const copyViewConfigOptionMap: Record<CopyViewConfigType, CopyViewConfigOption> = {
  [CopyViewConfigType.FieldVisibility]: {
    order: 1,
    label: 'Field visibility',
    value: CopyViewConfigType.FieldVisibility,
    i18nLabel: `objects.copyViewConfig.${CopyViewConfigType.FieldVisibility}`,
    supportedViewTypes: [ViewTypes.GRID, ViewTypes.GALLERY, ViewTypes.KANBAN, ViewTypes.FORM, ViewTypes.CALENDAR, ViewTypes.MAP],
  },
  [CopyViewConfigType.FieldOrder]: {
    order: 2,
    label: 'Field order',
    value: CopyViewConfigType.FieldOrder,
    i18nLabel: `objects.copyViewConfig.${CopyViewConfigType.FieldOrder}`,
    supportedViewTypes: [ViewTypes.GRID, ViewTypes.GALLERY, ViewTypes.KANBAN, ViewTypes.FORM, ViewTypes.CALENDAR, ViewTypes.MAP],
  },
  [CopyViewConfigType.ColumnWidthAndRowHeight]: {
    order: 3,
    label: 'Column width and row height',
    value: CopyViewConfigType.ColumnWidthAndRowHeight,
    i18nLabel: `objects.copyViewConfig.${CopyViewConfigType.ColumnWidthAndRowHeight}`,
    supportedViewTypes: [ViewTypes.GRID],
  },
  [CopyViewConfigType.RowHeight]: {
    order: 4,
    label: 'Row height',
    value: CopyViewConfigType.RowHeight,
    i18nLabel: `objects.copyViewConfig.${CopyViewConfigType.RowHeight}`,
    supportedViewTypes: [ViewTypes.GRID],
  },
  [CopyViewConfigType.Filters]: {
    order: 5,
    label: 'Filters',
    value: CopyViewConfigType.Filters,
    i18nLabel: `objects.copyViewConfig.${CopyViewConfigType.Filters}`,
    supportedViewTypes: [ViewTypes.GRID, ViewTypes.GALLERY, ViewTypes.KANBAN, ViewTypes.CALENDAR, ViewTypes.MAP],
  },
  [CopyViewConfigType.Groups]: {
    order: 6,
    label: 'Groups',
    value: CopyViewConfigType.Groups,
    i18nLabel: `objects.copyViewConfig.${CopyViewConfigType.Groups}`,
    supportedViewTypes: [ViewTypes.GRID],
  },
  [CopyViewConfigType.Sorts]: {
    order: 7,
    label: 'Sorts',
    value: CopyViewConfigType.Sorts,
    i18nLabel: `objects.copyViewConfig.${CopyViewConfigType.Sorts}`,
    supportedViewTypes: [ViewTypes.GRID, ViewTypes.GALLERY, ViewTypes.KANBAN, ViewTypes.CALENDAR],
  },
  [CopyViewConfigType.RowColoring]: {
    order: 8,
    label: 'Row coloring',
    value: CopyViewConfigType.RowColoring,
    i18nLabel: `objects.copyViewConfig.${CopyViewConfigType.RowColoring}`,
    supportedViewTypes: [ViewTypes.GRID, ViewTypes.GALLERY, ViewTypes.KANBAN, ViewTypes.CALENDAR],
  },
}

/**
 * Retrieves all copy view configuration options with their availability status for a specific view type.
 *
 * This function returns all available configuration options, marking each as enabled or disabled
 * based on whether the source view type supports that particular configuration.
 * The returned options are sorted by their display order.
 *
 * @param copyFromViewType - The view type from which configurations will be copied
 * @returns An array of configuration options with a 'disabled' flag indicating support status, sorted by order
 *
 * @example
 * ```ts
 * // Get all config options for copying from a Grid view
 * const options = getCopyViewConfigOptions(ViewTypes.GRID)
 * // Filter to only enabled options
 * const enabledOptions = options.filter(opt => !opt.disabled)
 * ```
 */
export const getCopyViewConfigOptions = (copyFromViewType?: ViewTypes) => {
  return Object.values(copyViewConfigOptionMap)
    .map((option) => {
      const { supportedViewTypes, ...rest } = option
      return {
        ...rest,
        disabled: !ncIsUndefined(copyFromViewType) && !supportedViewTypes.includes(copyFromViewType),
      }
    })
    .sort((a, b) => a.order - b.order)
}

/**
 * Filters a list of copy view configuration types to only include those supported by the source view type.
 *
 * This function validates each configuration type against the source view type's capabilities,
 * removing any unsupported or invalid configuration types from the list.
 *
 * @param copyViewConfigTypes - Array of configuration types to be validated
 * @param copyFromViewType - The view type from which configurations will be copied
 * @returns A filtered array containing only the configuration types supported by the source view type
 *
 * @example
 * ```ts
 * // Validate selected config types for a Form view
 * const selectedTypes = [CopyViewConfigType.FieldVisibility, CopyViewConfigType.Filters, CopyViewConfigType.Groups]
 * const supportedTypes = extractSupportedCopyViewConfigTypes(selectedTypes, ViewTypes.FORM)
 * // Result: Only FieldVisibility will be included since Forms don't support Filters or Groups
 * ```
 */
export const extractSupportedCopyViewConfigTypes = (copyViewConfigTypes: CopyViewConfigType[], copyFromViewType: ViewTypes) => {
  return copyViewConfigTypes.filter((type) => {
    if (!copyViewConfigOptionMap[type]) return false

    return copyViewConfigOptionMap[type].supportedViewTypes.includes(copyFromViewType)
  })
}
