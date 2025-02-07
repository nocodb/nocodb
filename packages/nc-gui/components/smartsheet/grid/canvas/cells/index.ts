import { type TableType, UITypes, type ViewType, isAIPromptCol } from 'nocodb-sdk'
import { renderSingleLineText, renderSpinner } from '../utils/canvas'
import type { ActionManager } from '../loaders/ActionManager'
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
import { ButtonCellRenderer } from './Button'
import { LtarCellRenderer } from './LTAR'
import { FormulaCellRenderer } from './Formula'

export function useGridCellHandler(params: {
  getCellPosition: (column: CanvasGridColumn, rowIndex: number) => { x: number; y: number; width: number; height: number }
  actionManager: ActionManager
  makeCellEditable: (rowIndex: number, clickedColumn: CanvasGridColumn) => void
  updateOrSaveRow: (
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
    beforeRow?: string,
  ) => Promise<any>
  meta?: Ref<TableType>
}) {
  const { t } = useI18n()
  const { metas } = useMetas()

  const baseStore = useBase()
  const { isMssql, isMysql, isXcdbBase } = baseStore
  const { sqlUis } = storeToRefs(baseStore)

  const actionManager = params.actionManager
  const makeCellEditable = params.makeCellEditable

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
  cellTypesRegistry.set(UITypes.Button, ButtonCellRenderer)
  cellTypesRegistry.set(UITypes.LinkToAnotherRecord, LtarCellRenderer)
  cellTypesRegistry.set(UITypes.Formula, FormulaCellRenderer)

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
      padding = 10,
      relatedColObj,
      relatedTableMeta,
      tag = {},
      fontSize = 13,
      textAlign = 'center',
      textColor,
      disabled,
      mousePosition,
      pk,
      meta = params.meta?.value,
    }: Omit<CellRendererOptions, 'metas' | 'isMssql' | 'isMysql' | 'isXcdbBase' | 'sqlUis'>,
  ) => {
    const cellType = cellTypesRegistry.get(column.uidt)
    if (actionManager?.isLoading(pk, column.id) && !isAIPromptCol(column) && !isButton(column)) {
      const loadingStartTime = actionManager?.getLoadingStartTime(pk, column.id)
      if (loadingStartTime) {
        renderSpinner(ctx, x + width / 2, y + 8, 16, '#3366FF', loadingStartTime, 1.5)
        return
      }
    }

    if (cellType) {
      return cellType.render(ctx, {
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
        actionManager,
        isMssql,
        isMysql,
        isXcdbBase,
        t,
        padding,
        relatedColObj,
        relatedTableMeta,
        renderCell,
        meta,
        metas: metas.value,
        tag,
        fontSize,
        textAlign,
        mousePosition,
        textColor,
        pk,
        disabled,
        sqlUis: sqlUis.value,
      })
    } else {
      return renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text: value?.toString() ?? '',
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#4351e8' : textColor,
        height,
        py: padding,
      })
    }
  }

  const handleCellClick = async (ctx: {
    event: MouseEvent
    row: Row
    column: CanvasGridColumn
    value: any
    mousePosition: { x: number; y: number }
    pk: any
    selected: boolean
    imageLoader: ImageWindowLoader
  }) => {
    if (!params?.getCellPosition) return
    const cellHandler = cellTypesRegistry.get(ctx.column.columnObj.uidt)

    if (cellHandler?.handleClick) {
      return await cellHandler.handleClick({
        ...ctx,
        isDoubleClick: ctx.event.detail === 2,
        getCellPosition: params?.getCellPosition,
        updateOrSaveRow: params?.updateOrSaveRow,
        actionManager,
        makeCellEditable,
      })
    }
    return false
  }

  const handleCellKeyDown = async (ctx: { e: KeyboardEvent; row: Row; column: CanvasGridColumn; value: any; pk: any }) => {
    const cellHandler = cellTypesRegistry.get(ctx.column.columnObj!.uidt!)

    if (cellHandler?.handleKeyDown) {
      return await cellHandler.handleKeyDown({
        ...ctx,
        updateOrSaveRow: params?.updateOrSaveRow,
        actionManager,
        makeCellEditable,
      })
    } else {
      console.log('No handler found for cell type', ctx.column.columnObj.uidt)
    }

    return false
  }

  const handleCellHover = async (ctx: {
    event: MouseEvent
    row: Row
    column: CanvasGridColumn
    value: any
    mousePosition: { x: number; y: number }
    pk: any
    selected: boolean
    imageLoader: ImageWindowLoader
  }) => {
    if (!params?.getCellPosition) return
    const cellHandler = cellTypesRegistry.get(ctx.column.columnObj.uidt)

    if (cellHandler?.handleHover) {
      return await cellHandler.handleHover({
        ...ctx,
        getCellPosition: params?.getCellPosition,
        updateOrSaveRow: params?.updateOrSaveRow,
        actionManager,
        makeCellEditable,
      })
    }
  }

  return {
    cellTypesRegistry,
    renderCell,
    handleCellClick,
    handleCellKeyDown,
    handleCellHover,
  }
}
