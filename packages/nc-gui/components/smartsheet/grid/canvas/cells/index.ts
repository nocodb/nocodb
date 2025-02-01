import { UITypes, type ColumnType, type TableType } from 'nocodb-sdk'
import type { SpriteLoader } from '../loaders/SpriteLoader'
import type { ImageWindowLoader } from '../loaders/ImageLoader'
import { EmailCellRenderer } from './Email'
import { SingleLineTextCellRenderer } from './SingleLineText'
import { LongTextCellRenderer } from './LongText'
import { FloatCellRenderer } from './Number'
import { DecimalCellRenderer } from './Decimal'
import { AttachmentCellRenderer } from './Attachment'
import { CheckboxCellRenderer } from './Checkbox'
import { DateCellRenderer } from './Date'
import { DateTimeCellRenderer } from './DateTime'
import { YearCellRenderer } from './Year'
import { TimeCellRenderer } from './Time'
import { CurrencyRenderer } from './Currency'
import { PercentCellRenderer } from './Percent'
import { UrlCellRenderer } from './Url'
import { GeoDataCellRenderer } from './GeoData'
import { PhoneNumberCellRenderer } from './PhoneNumber'
import { DurationCellRenderer } from './Duration'
import { JsonCellRenderer } from './Json'
import { BarcodeCellRenderer } from './Barcode'
import { QRCodeCellRenderer } from './QRCode'
import { RatingCellRenderer } from './Rating'
import { UserFieldCellRenderer } from './User'
import { SingleSelectCellRenderer } from './SingleSelect'
import { MultiSelectCellRenderer } from './MultiSelect'
import { RollupCellRenderer } from './Rollup'
import { LinksCellRenderer } from './Links'
import { LookupCellRenderer } from './Lookup'
import { renderSingleLineText } from '../utils/canvas'
export function useCellRenderer() {
  const { t } = useI18n()
  const { metas } = useMetas()

  const cellTypesRegistry = new Map<string, CellRenderer>()

  cellTypesRegistry.set(UITypes.Email, EmailCellRenderer)
  cellTypesRegistry.set(UITypes.SingleLineText, SingleLineTextCellRenderer)
  cellTypesRegistry.set(UITypes.LongText, LongTextCellRenderer)
  cellTypesRegistry.set(UITypes.Number, FloatCellRenderer)
  cellTypesRegistry.set(UITypes.Decimal, DecimalCellRenderer)
  cellTypesRegistry.set(UITypes.Attachment, AttachmentCellRenderer)
  cellTypesRegistry.set(UITypes.Checkbox, CheckboxCellRenderer)
  cellTypesRegistry.set(UITypes.Date, DateCellRenderer)
  cellTypesRegistry.set(UITypes.DateTime, DateTimeCellRenderer)
  cellTypesRegistry.set(UITypes.Year, YearCellRenderer)
  cellTypesRegistry.set(UITypes.Time, TimeCellRenderer)
  cellTypesRegistry.set(UITypes.Currency, CurrencyRenderer)
  cellTypesRegistry.set(UITypes.Percent, PercentCellRenderer)
  cellTypesRegistry.set(UITypes.URL, UrlCellRenderer)
  cellTypesRegistry.set(UITypes.GeoData, GeoDataCellRenderer)
  cellTypesRegistry.set(UITypes.PhoneNumber, PhoneNumberCellRenderer)
  cellTypesRegistry.set(UITypes.Duration, DurationCellRenderer)
  cellTypesRegistry.set(UITypes.CreatedTime, DateTimeCellRenderer)
  cellTypesRegistry.set(UITypes.LastModifiedTime, DateTimeCellRenderer)
  cellTypesRegistry.set(UITypes.JSON, JsonCellRenderer)
  cellTypesRegistry.set(UITypes.Barcode, BarcodeCellRenderer)
  cellTypesRegistry.set(UITypes.QrCode, QRCodeCellRenderer)
  cellTypesRegistry.set(UITypes.Rating, RatingCellRenderer)
  cellTypesRegistry.set(UITypes.User, UserFieldCellRenderer)
  cellTypesRegistry.set(UITypes.CreatedBy, UserFieldCellRenderer)
  cellTypesRegistry.set(UITypes.LastModifiedBy, UserFieldCellRenderer)
  cellTypesRegistry.set(UITypes.SingleSelect, SingleSelectCellRenderer)
  cellTypesRegistry.set(UITypes.MultiSelect, MultiSelectCellRenderer)
  cellTypesRegistry.set(UITypes.Rollup, RollupCellRenderer)
  cellTypesRegistry.set(UITypes.Links, LinksCellRenderer)
  cellTypesRegistry.set(UITypes.Lookup, LookupCellRenderer)

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
      spriteLoader,
      imageLoader,
      isMysql,
      padding = 10,
      relatedColObj,
      relatedTableMeta,
      tag = {},
      fontSize = 13,
      textAlign = 'center',
      textColor,
    }: CellRendererOptions,
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
        spriteLoader,
        imageLoader,
        isMysql,
        t,
        padding,
        relatedColObj,
        relatedTableMeta,
        renderCell,
        metas,
        tag,
        fontSize,
        textAlign,
        textColor,
      })
    } else {
      renderSingleLineText(ctx, {
        x: x + padding,
        y: y,
        text: value?.toString() ?? '',
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#4351e8' : textColor,
        height,
        py: padding,
      })
    }
  }

  return {
    cellTypesRegistry,
    renderCell,
  }
}
