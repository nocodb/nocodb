import type { ColumnType, SelectOptionType } from 'nocodb-sdk'
import { defaultOffscreen2DContext } from '../../smartsheet/grid/canvas/utils/canvas'

export type LocalSelectOptionType = SelectOptionType & { value?: string; bgColor?: string; textColor?: string }

export const getOptions = (
  column: ColumnType,
  isEditColumn: boolean,
  isForm: boolean,
  isDark: boolean,
  getColor: GetColorType,
): LocalSelectOptionType[] => {
  if (column && column?.colOptions) {
    const opts = column.colOptions
      ? // todo: fix colOptions type, options does not exist as a property
        (column.colOptions as any).options.filter((el: SelectOptionType) => el.title !== '') || []
      : []

    for (const op of opts) {
      // malformed colOptions can carry non-string titles (e.g. numbers) — normalize
      // so downstream optionsMap keys and lookups always operate on strings
      if (!ncIsString(op.title) && !ncIsNullOrUndefined(op.title)) {
        op.title = String(op.title)
      }

      if (op.order === null && ncIsString(op.title)) {
        op.title = op.title.replace(/^'/, '').replace(/'$/, '')
      }
    }

    const isColorCodeEnabled = parseProp(column.meta)?.isColorCodeEnabled !== false

    let order = 1

    const limitOptionsById =
      ((parseProp(column.meta)?.limitOptions || []).reduce(
        (o: Record<string, FormFieldsLimitOptionsType>, f: FormFieldsLimitOptionsType) => {
          if (order < (f?.order ?? 0)) {
            order = f.order
          }
          return {
            ...o,
            [f.id]: f,
          }
        },
        {},
      ) as Record<string, FormFieldsLimitOptionsType>) ?? {}

    if (!isEditColumn && isForm && parseProp(column.meta)?.isLimitOption && (parseProp(column.meta)?.limitOptions || []).length) {
      return opts
        .filter((o: LocalSelectOptionType) => {
          if (limitOptionsById[o.id]?.show !== undefined) {
            return limitOptionsById[o.id]?.show
          }
          return false
        })
        .map((o: any) => ({
          ...o,
          value: o.title,
          order: o.id && limitOptionsById[o.id] ? limitOptionsById[o.id]?.order : order++,
          bgColor: getSelectTypeFieldOptionBgColor({ color: o.color, isDark, getColor, isColorCodeEnabled }),
          textColor: getSelectTypeFieldOptionTextColor({ color: o.color, isDark, getColor, isColorCodeEnabled }),
        }))
        .sort((a, b) => a.order - b.order)
    } else {
      return opts.map((o: any) => ({
        ...o,
        value: o.title,
        bgColor: getSelectTypeFieldOptionBgColor({ color: o.color, isDark, getColor, isColorCodeEnabled }),
        textColor: getSelectTypeFieldOptionTextColor({ color: o.color, isDark, getColor, isColorCodeEnabled }),
      }))
    }
  }
  return []
}

/**
 * Width for a select dropdown in a filter, whose value input is too narrow for option
 * titles: the longest title (capped at 360px). Ant keeps the trigger width as the minimum.
 * `extra` covers anything beside the tag, e.g. the multi-select check.
 */
export const getFilterSelectDropdownWidth = (titles: Array<string | undefined>, extra = 0): number => {
  defaultOffscreen2DContext.font = '13px Inter'

  const longest = titles.reduce((max, title) => Math.max(max, defaultOffscreen2DContext.measureText(title ?? '').width), 0)

  // Canvas measures ~5% narrower than the rendered tag text; 56px = option + tag padding and the scrollbar.
  return Math.min(Math.ceil(longest * 1.1) + 56 + extra, 360)
}
