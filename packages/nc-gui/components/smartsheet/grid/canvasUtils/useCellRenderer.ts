import { UITypes } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'
import { EmailCellRenderer } from './cells/Email'
import { SingleLineTextCellRenderer } from './cells/SingleLineText'
import { LongTextCellRenderer } from './cells/LongText'
import { FloatCellRenderer } from './cells/Number'
import { DecimalCellRenderer } from './cells/DecimalCellRenderer'
import { AttachmentCellRenderer } from './cells/AttachmentCellRenderer'
import { CheckboxCellRenderer } from './cells/CheckboxCellRenderer'
import { DateCellRenderer } from './cells/DateCellRenderer'
import { DateTimeCellRenderer } from './cells/DateTimeCellRenderer'
import { YearCellRenderer } from './cells/YearCellRenderer'
import { TimeCellRenderer } from './cells/TimeCellRenderer'
import { CurrencyRenderer } from './cells/CurrencyCellRenderer'
import { PercentCellRenderer } from './cells/PercentCellRenderer'
import { UrlCellRenderer } from './cells/UrlCellRenderer'
import { GeoDataCellRenderer } from './cells/GeoDataCellRenderer'
import { PhoneNumberCellRenderer } from './cells/PhoneNumberRenderer'
import { DurationCellRenderer } from './cells/DurationCellRenderer'
import { JsonCellRenderer } from './cells/JSONCellRenderer';

export interface CellRenderer {
  render: (
    ctx: CanvasRenderingContext2D,
    options: {
      value: any
      row: any
      column: ColumnType
      x: number
      y: number
      width: number
      height: number
      selected: boolean
      pv?: boolean
      readonly?: boolean
    },
  ) => void
}

export function useCellRenderer() {
  const cellTypesRegistry = new Map<string, CellRenderer>()

  const registerCellType = (type: string, renderer: CellRenderer) => {
    cellTypesRegistry.set(type, renderer)
  }

  const renderCell = (
    ctx: CanvasRenderingContext2D,
    column: any,
    {
      value,
      row,
      x,
      y,
      width,
      height,
      selected = false,
      pv = false,
      readonly = false,
    }: {
      value: any
      row: any
      x: number
      y: number
      width: number
      height: number
      selected?: boolean
      pv?: boolean
      readonly?: boolean
    },
  ) => {
    const cellType = cellTypesRegistry.get(column.uidt)

    if (cellType) {
      cellType.render(ctx, {
        value,
        row,
        column,
        x,
        y,
        width,
        height,
        selected,
        pv,
        readonly,
      })
    } else {
      ctx.fillStyle = pv ? '#4351e8' : '#4a5268'
      ctx.font = `${pv ? 600 : 500} 13px Manrope`
      ctx.textBaseline = 'middle'
      ctx.fillText(value?.toString() ?? '', x + 10, y + height / 2)
    }
  }

  onMounted(() => {
    registerCellType(UITypes.Email, EmailCellRenderer)
    registerCellType(UITypes.SingleLineText, SingleLineTextCellRenderer)
    registerCellType(UITypes.LongText, LongTextCellRenderer)
    registerCellType(UITypes.Number, FloatCellRenderer)
    registerCellType(UITypes.Decimal, DecimalCellRenderer)
    registerCellType(UITypes.Attachment, AttachmentCellRenderer)
    registerCellType(UITypes.Checkbox, CheckboxCellRenderer)
    registerCellType(UITypes.Date, DateCellRenderer)
    registerCellType(UITypes.DateTime, DateTimeCellRenderer)
    registerCellType(UITypes.Year, YearCellRenderer)
    registerCellType(UITypes.Time, TimeCellRenderer)
    registerCellType(UITypes.Currency, CurrencyRenderer)
    registerCellType(UITypes.Percent, PercentCellRenderer)
    registerCellType(UITypes.URL, UrlCellRenderer)
    registerCellType(UITypes.GeoData, GeoDataCellRenderer)
    registerCellType(UITypes.PhoneNumber, PhoneNumberCellRenderer)
    registerCellType(UITypes.Duration, DurationCellRenderer)
    registerCellType(UITypes.CreatedTime, DateTimeCellRenderer)
    registerCellType(UITypes.LastModifiedTime, DateTimeCellRenderer)
    registerCellType(UITypes.JSON, JsonCellRenderer)
  })

  return {
    cellTypesRegistry,
    registerCellType,
    renderCell,
  }
}
