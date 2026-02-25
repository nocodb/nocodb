import { type ColumnType, type TableType, UITypes } from 'nocodb-sdk'
import { renderSingleLineText } from '../../grid/canvas/utils/canvas'
import type { SpriteLoader } from '../../grid/canvas/loaders/SpriteLoader'
import { ImageWindowLoader } from '../../grid/canvas/loaders/ImageLoader'
import { MarkdownLoader } from '../../grid/canvas/loaders/markdownLoader'
import { EmailCellRenderer } from '../../grid/canvas/cells/Email'
import { SingleLineTextCellRenderer } from '../../grid/canvas/cells/SingleLineText'
import { LongTextCellRenderer } from '../../grid/canvas/cells/LongText'
import { FloatCellRenderer } from '../../grid/canvas/cells/Number'
import { DecimalCellRenderer } from '../../grid/canvas/cells/Decimal'
import { AttachmentCellRenderer } from '../../grid/canvas/cells/Attachment'
import { CheckboxCellRenderer } from '../../grid/canvas/cells/Checkbox'
import { DateCellRenderer } from '../../grid/canvas/cells/Date'
import { DateTimeCellRenderer } from '../../grid/canvas/cells/DateTime'
import { YearCellRenderer } from '../../grid/canvas/cells/Year'
import { TimeCellRenderer } from '../../grid/canvas/cells/Time'
import { CurrencyRenderer } from '../../grid/canvas/cells/Currency'
import { PercentCellRenderer } from '../../grid/canvas/cells/Percent'
import { UrlCellRenderer } from '../../grid/canvas/cells/Url'
import { GeoDataCellRenderer } from '../../grid/canvas/cells/GeoData'
import { PhoneNumberCellRenderer } from '../../grid/canvas/cells/PhoneNumber'
import { DurationCellRenderer } from '../../grid/canvas/cells/Duration'
import { JsonCellRenderer } from '../../grid/canvas/cells/Json'
import { BarcodeCellRenderer } from '../../grid/canvas/cells/Barcode'
import { QRCodeCellRenderer } from '../../grid/canvas/cells/QRCode'
import { RatingCellRenderer } from '../../grid/canvas/cells/Rating'
import { ColourCellRenderer } from '../../grid/canvas/cells/Colour'
import { UserFieldCellRenderer } from '../../grid/canvas/cells/User'
import { SingleSelectCellRenderer } from '../../grid/canvas/cells/SingleSelect'
import { MultiSelectCellRenderer } from '../../grid/canvas/cells/MultiSelect'
import { RollupCellRenderer } from '../../grid/canvas/cells/Rollup'
import { LinksCellRenderer } from '../../grid/canvas/cells/Links'
import { LookupCellRenderer } from '../../grid/canvas/cells/Lookup'
import { ButtonCellRenderer } from '../../grid/canvas/cells/Button'
import { LtarCellRenderer } from '../../grid/canvas/cells/LTAR'
import { FormulaCellRenderer } from '../../grid/canvas/cells/Formula'
import { UUIDCellRenderer } from '../../grid/canvas/cells/UUID'
import { GenericReadOnlyRenderer } from '../../grid/canvas/cells/GenericReadonlyRenderer'
import { NullCellRenderer } from '../../grid/canvas/cells/Null'
import { PlainCellRenderer } from '../../grid/canvas/cells/Plain'
import { ActionManager } from '../../grid/canvas/loaders/ActionManager'

const CLEANUP_INTERVAL = 1000

export function useOutlineCellRenderer(params: {
  spriteLoader: SpriteLoader
  triggerRefreshCanvas: () => void
  setCursor: SetCursorType
  meta: Ref<TableType | undefined>
  cachedRows: Ref<Map<number, Row>>
  totalRows: Ref<number>
  chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
  updateOrSaveRow: (row: Row, property?: string) => Promise<any>
}) {
  const { spriteLoader, triggerRefreshCanvas, setCursor } = params

  const { getColor, isDark } = useTheme()
  const { metas } = useMetas()
  const { showNull, appInfo, user } = useGlobal()
  const { t } = useI18n()
  const { $api } = useNuxtApp()

  const isPublic = inject(IsPublicInj, ref(false))

  const baseStore = useBase()
  const { isMysql, isXcdbBase, isPg } = baseStore
  const { sqlUis } = storeToRefs(baseStore)

  const { basesUser } = storeToRefs(useBases())

  const imageLoader = new ImageWindowLoader(() => triggerRefreshCanvas())
  const markdownLoader = new MarkdownLoader(() => triggerRefreshCanvas())

  const { generateRows: _generateRows } = useNocoAi()
  const { eventBus: scriptEventBus } = useScriptExecutor()
  const { loadScript } = useScriptStore()
  const { currentUser } = useUserSync()

  function generateRows(columnId: string, rowIds: string[]) {
    return _generateRows(params.meta.value?.id, columnId, rowIds)
  }

  const emptySelectedRows = computed(() => [] as Array<Row>)
  const emptyIsRowSortRequired = computed(() => [] as Array<Row>)

  const getDataCache = () => ({
    cachedRows: params.cachedRows,
    totalRows: params.totalRows,
    chunkStates: params.chunkStates,
    selectedRows: emptySelectedRows,
    isRowSortRequiredRows: emptyIsRowSortRequired,
  })

  const actionManager = new ActionManager(
    $api,
    loadScript,
    generateRows,
    params.meta as Ref<TableType>,
    triggerRefreshCanvas,
    getDataCache,
    scriptEventBus,
    currentUser,
  )

  if (baseStore.base?.id && baseStore.base?.fk_workspace_id) {
    actionManager.setBaseInfo(baseStore.base.id, baseStore.base.fk_workspace_id)
  }

  onUnmounted(() => {
    actionManager.releaseEventListeners()
  })

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
  cellTypesRegistry.set(UITypes.Colour, ColourCellRenderer)
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
  cellTypesRegistry.set(UITypes.UUID, UUIDCellRenderer)
  cellTypesRegistry.set(UITypes.ForeignKey, GenericReadOnlyRenderer)
  cellTypesRegistry.set(UITypes.ID, GenericReadOnlyRenderer)

  const cellRenderStoreMap = new Map<string, CellRenderStore>()
  const expirationTimes = new Map<string, number>()

  const getCellRenderStore = (key: string) => {
    if (!cellRenderStoreMap.has(key)) {
      cellRenderStoreMap.set(key, {})
    }
    expirationTimes.set(key, Date.now() + CLEANUP_INTERVAL)
    return cellRenderStoreMap.get(key)!
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
      pv = false,
      padding = 10,
      pk,
      mousePosition,
      meta,
      isRowHovered = false,
      renderAsPlainCell = false,
      relatedColObj,
      relatedTableMeta,
      textColor,
      fontFamily,
      readonly = false,
    }: Omit<CellRendererOptions, 'metas' | 'isMysql' | 'isXcdbBase' | 'sqlUis' | 'baseUsers' | 'isPg'>,
  ) => {
    const cellType = cellTypesRegistry.get(column.uidt!)
    const cellRenderStore = getCellRenderStore(`${column.id}-${pk}`)

    const shouldRenderNull = showNull.value && isShowNullField(column) && (ncIsUndefined(value) || ncIsNull(value))

    let cellRenderer: CellRenderFn | undefined

    if (renderAsPlainCell) {
      cellRenderer = PlainCellRenderer.render
    } else if (cellType) {
      cellRenderer = shouldRenderNull ? cellType.renderEmpty ?? NullCellRenderer.render : cellType.render
    } else if (shouldRenderNull) {
      cellRenderer = NullCellRenderer.render
    }

    ctx.textAlign = 'left'

    if (cellRenderer) {
      cellRenderer(ctx, {
        value,
        row,
        column,
        x,
        y,
        width,
        height,
        selected: false,
        pv,
        readonly,
        spriteLoader,
        imageLoader,
        markdownLoader,
        isMysql,
        isPg,
        isXcdbBase,
        t,
        padding,
        renderCell,
        meta,
        metas: metas.value,
        relatedColObj,
        relatedTableMeta,
        tag: {},
        fontSize: 13,
        textAlign: 'center',
        textColor,
        mousePosition,
        pk,
        disabled: false,
        sqlUis: sqlUis.value,
        actionManager,
        setCursor,
        getColor,
        isDark: isDark.value,
        cellRenderStore,
        baseUsers: meta?.base_id ? basesUser.value.get(meta.base_id) || [] : [],
        user: user.value,
        isUnderLookup: false,
        isPublic: isPublic.value,
        path: [],
        fontFamily,
        isRowHovered,
        isRowChecked: false,
        rowMeta: {},
        allowLocalUrl: appInfo.value?.allowLocalUrl,
      })
    } else {
      renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text: value?.toString() ?? '',
        fontFamily: fontFamily ?? `${pv ? 600 : 500} 13px Inter`,
        fillStyle: pv ? getColor(themeV4Colors.brand['500']) : getColor(textColor ?? themeV4Colors.gray['600']),
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
    path: Array<number>
    cellPosition: { x: number; y: number; width: number; height: number }
  }) => {
    if (!ctx.column?.columnObj?.uidt) return false

    const cellHandler = cellTypesRegistry.get(ctx.column.columnObj.uidt)
    const cellRenderStore = getCellRenderStore(`${ctx.column.id}-${ctx.pk}`)

    if (cellHandler?.handleClick) {
      return await cellHandler.handleClick({
        ...ctx,
        cellRenderStore,
        isDoubleClick: ctx.event.detail === 2,
        readonly: ctx.column.readonly,
        getCellPosition: () => ctx.cellPosition,
        updateOrSaveRow: params.updateOrSaveRow,
        actionManager,
        makeCellEditable: () => {},
        markdownLoader,
        isPublic: isPublic.value,
        openDetachedExpandedForm: () => {},
        openDetachedLongText: () => {},
        allowLocalUrl: appInfo.value?.allowLocalUrl,
        t,
        getColor,
        baseRoles: {},
      })
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

    if (cellHandler?.handleHover) {
      return await cellHandler.handleHover({
        ...ctx,
        cellRenderStore,
        setCursor,
        markdownLoader,
        path: [],
        baseUsers: ctx.row?.row?.base_id ? basesUser.value.get(ctx.row.row.base_id) || [] : [],
        t,
        getCellPosition: () => ({ x: 0, y: 0, width: 0, height: 0 }),
        updateOrSaveRow: params.updateOrSaveRow,
        actionManager,
        makeCellEditable: () => {},
      })
    }
  }

  return {
    renderCell,
    handleCellClick,
    handleCellHover,
    imageLoader,
    actionManager,
  }
}
