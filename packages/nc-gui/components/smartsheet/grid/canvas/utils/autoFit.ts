import { type ColumnType, UITypes, parseProp } from 'nocodb-sdk'
import { getSelectedUsers } from '../../../../cell/User/utils'

// Types drawn as plain text, so measuring their display text gives the width they need
const TEXT_TYPES = new Set<string>([
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.Email,
  UITypes.URL,
  UITypes.PhoneNumber,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Duration,
  UITypes.Date,
  UITypes.DateTime,
  UITypes.Time,
  UITypes.Year,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.AutoNumber,
  UITypes.ID,
  UITypes.GeoData,
  UITypes.UUID,
  UITypes.JSON,
  UITypes.Rollup,
])

const USER_TYPES = new Set<string>([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy])

// Matches the cell renderers: 10px cell padding per side, 8px chip padding per side, 8px between chips
const CELL_PADDING = 20
const CHIP_PADDING = 16
const CHIP_GAP = 8
// user chips draw a 14px avatar followed by an 8px gap
const USER_AVATAR = 22
// the links count leaves room for its expand icon
const LINKS_ICON = 20

export type AutoFitContext = Omit<ParsePlainCellValueProps['params'], 'col'>

// grid columns carry the formula display type and the user options map in `extra`
type AutoFitColumn = ColumnType & {
  extra?: { display_type?: string; optionsMap?: Parameters<typeof getSelectedUsers>[0] }
}

/** Whether double-clicking the column divider can fit this field to its content. */
export function isAutoFitSupported(column: AutoFitColumn) {
  const uidt = column.uidt as string
  if (uidt === UITypes.Formula) return !column.extra?.display_type && !parseProp(column.meta)?.display_type
  return (
    TEXT_TYPES.has(uidt) ||
    USER_TYPES.has(uidt) ||
    [UITypes.SingleSelect, UITypes.MultiSelect, UITypes.Links].includes(uidt as UITypes)
  )
}

/** Width a cell needs to show `value` without truncating, measured the way the grid draws it. */
export function measureAutoFitCell(
  ctx: CanvasRenderingContext2D,
  column: AutoFitColumn,
  value: unknown,
  fitContext: AutoFitContext,
): number {
  const textWidth = (text: string, font = `${column.pv ? 600 : 500} 13px Inter`) => {
    ctx.font = font
    return ctx.measureText(text).width
  }

  const chipsWidth = (texts: string[], extra = 0) =>
    texts.reduce((sum, text) => sum + textWidth(text, '500 13px Inter') + CHIP_PADDING + extra, 0) +
    Math.max(texts.length - 1, 0) * CHIP_GAP +
    CELL_PADDING

  switch (column.uidt) {
    case UITypes.SingleSelect:
      return chipsWidth([String(value)])

    case UITypes.MultiSelect: {
      const options = (Array.isArray(value) ? value : String(value).split(',')).map((o) => String(o).trim()).filter(Boolean)
      return chipsWidth(options)
    }

    case UITypes.User:
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy: {
      const users = getSelectedUsers(column.extra?.optionsMap || {}, value as Parameters<typeof getSelectedUsers>[1])
      return chipsWidth(
        users.map((user) => extractUserDisplayNameOrEmail({ display_name: user.display_name ?? '', email: user.email })),
        USER_AVATAR,
      )
    }

    case UITypes.Links: {
      const count = Number(value) || 0
      const linksMeta = parseProp(column.meta)
      const text = !count
        ? fitContext.t('msg.noRecordsLinked')
        : count === 1
        ? `1 ${linksMeta?.singular || fitContext.t('general.link')}`
        : `${count} ${linksMeta?.plural || fitContext.t('general.links')}`
      return textWidth(text, '500 13px Inter') + LINKS_ICON + CELL_PADDING
    }

    case UITypes.Formula:
      return textWidth(String(value).split('\n')[0]!) + CELL_PADDING

    case UITypes.JSON:
      return textWidth(typeof value === 'string' ? value : JSON.stringify(value)) + CELL_PADDING

    default: {
      const text = parsePlainCellValue(value, { ...fitContext, col: column })
      return textWidth(`${text ?? ''}`.split('\n')[0]!) + CELL_PADDING
    }
  }
}
