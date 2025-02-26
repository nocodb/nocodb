import { type ColumnType, type TableType, UITypes, type UserType, type ViewType, isAIPromptCol } from 'nocodb-sdk'
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
import { GenericReadOnlyRenderer } from './GenericReadonlyRenderer'

const CLEANUP_INTERVAL = 1000

export function useGridCellHandler(params: {
  getCellPosition: (column: CanvasGridColumn, rowIndex: number) => { x: number; y: number; width: number; height: number }
  actionManager: ActionManager
  makeCellEditable: (row: number | Row, clickedColumn: CanvasGridColumn) => void
  updateOrSaveRow: (
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
    beforeRow?: string,
  ) => Promise<any>
  meta?: Ref<TableType>
  hasEditPermission: ComputedRef<boolean>
  setCursor: SetCursorType
}) {
  const { t } = useI18n()
  const { metas } = useMetas()
  const canvasCellEvents = reactive<ExtractInjectedReactive<typeof CanvasCellEventDataInj>>({})
  provide(CanvasCellEventDataInj, canvasCellEvents)

  const baseStore = useBase()
  const { isMssql, isMysql, isXcdbBase, isPg } = baseStore
  const { sqlUis } = storeToRefs(baseStore)

  const { basesUser } = storeToRefs(useBases())

  const baseUsers = computed<(Partial<UserType> | Partial<User>)[]>(() =>
    params.meta?.value?.base_id ? basesUser.value.get(params.meta?.value.base_id) || [] : [],
  )

  const actionManager = params.actionManager
  const makeCellEditable = params.makeCellEditable
  const setCursor = params.setCursor

  const cellRenderStoreMap = new Map<string, CellRenderStore>()
  const expirationTimes = new Map()

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
  cellTypesRegistry.set(UITypes.Geometry, SingleLineTextCellRenderer)
  cellTypesRegistry.set(UITypes.SpecificDBType, SingleLineTextCellRenderer)
  cellTypesRegistry.set(UITypes.ForeignKey, GenericReadOnlyRenderer)
  cellTypesRegistry.set(UITypes.ID, GenericReadOnlyRenderer)

  const getCellRenderStore = (key: string) => {
    if (!cellRenderStoreMap.has(key)) {
      cellRenderStoreMap.set(key, {})
      expirationTimes.set(key, Date.now() + CLEANUP_INTERVAL)
    } else {
      expirationTimes.set(key, Date.now() + CLEANUP_INTERVAL)
    }

    return cellRenderStoreMap.get(key)!
  }

  const renderCell = (
    ctx: CanvasRenderingContext2D,
    column: ColumnType,
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
      tableMetaLoader,
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
      skipRender = false,
      isUnderLookup = false,
    }: Omit<CellRendererOptions, 'metas' | 'isMssql' | 'isMysql' | 'isXcdbBase' | 'sqlUis' | 'baseUsers' | 'isPg'>,
  ) => {
    if (skipRender) return

    const cellType = cellTypesRegistry.get(column.uidt)
    if (actionManager?.isLoading(pk, column.id) && !isAIPromptCol(column) && !isButton(column)) {
      const loadingStartTime = actionManager?.getLoadingStartTime(pk, column.id)
      if (loadingStartTime) {
        renderSpinner(ctx, x + width / 2, y + 8, 16, '#3366FF', loadingStartTime, 1.5)
        return
      }
    }

    const cellRenderStore = getCellRenderStore(`${column.id}-${pk}`)

    // TODO: Reset all the styles here
    ctx.textAlign = 'left'
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
        readonly: readonly || !params.hasEditPermission.value,
        spriteLoader,
        imageLoader,
        actionManager,
        tableMetaLoader,
        isMssql,
        isMysql,
        isPg,
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
        setCursor,
        cellRenderStore,
        baseUsers: baseUsers.value,
        isUnderLookup,
      })
    } else {
      return renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text: value?.toString() ?? '',
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#3366FF' : textColor,
        height,
        py: padding,
        cellRenderStore,
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
    if (!ctx.column?.columnObj?.uidt) return

    const cellHandler = cellTypesRegistry.get(ctx.column.columnObj.uidt)

    const cellRenderStore = getCellRenderStore(`${ctx.column.id}-${ctx.pk}`)
    canvasCellEvents.keyboardKey = ''
    if (cellHandler?.handleClick) {
      return await cellHandler.handleClick({
        ...ctx,
        cellRenderStore,
        isDoubleClick: ctx.event.detail === 2,
        getCellPosition: params?.getCellPosition,
        readonly: !params.hasEditPermission.value,
        updateOrSaveRow: params?.updateOrSaveRow,
        actionManager,
        makeCellEditable,
      })
    }
    return false
  }

  const handleCellKeyDown = async (ctx: { e: KeyboardEvent; row: Row; column: CanvasGridColumn; value: any; pk: any }) => {
    const cellHandler = cellTypesRegistry.get(ctx.column.columnObj!.uidt!)

    const cellRenderStore = getCellRenderStore(`${ctx.column.id}-${ctx.pk}`)
    canvasCellEvents.keyboardKey = ctx.e.key
    if (cellHandler?.handleKeyDown) {
      return await cellHandler.handleKeyDown({
        ...ctx,
        cellRenderStore,
        readonly: !params.hasEditPermission.value,
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
    if (!ctx.column?.columnObj?.uidt) return

    const cellHandler = cellTypesRegistry.get(ctx.column.columnObj.uidt)

    const cellRenderStore = getCellRenderStore(`${ctx.column.id}-${ctx.pk}`)
    canvasCellEvents.keyboardKey = ''
    if (cellHandler?.handleHover) {
      return await cellHandler.handleHover({
        ...ctx,
        cellRenderStore,
        getCellPosition: params?.getCellPosition,
        updateOrSaveRow: params?.updateOrSaveRow,
        actionManager,
        makeCellEditable,
        setCursor,
      })
    }
  }

  let cleanUpInterval: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    cleanUpInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, expiration] of expirationTimes.entries()) {
        if (now >= expiration) {
          cellRenderStoreMap.delete(key)
          expirationTimes.delete(key)
        }
      }
    }, CLEANUP_INTERVAL)
  })

  onUnmounted(() => {
    if (cleanUpInterval) {
      clearInterval(cleanUpInterval)
    }
  })

  return {
    cellTypesRegistry,
    renderCell,
    handleCellClick,
    handleCellKeyDown,
    handleCellHover,
  }
}
