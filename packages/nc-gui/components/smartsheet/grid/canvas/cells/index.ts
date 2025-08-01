import { type ColumnType, type TableType, UITypes, type UserType, type ViewType, isAIPromptCol } from 'nocodb-sdk'
import { renderSingleLineText, renderSpinner, roundedRect } from '../utils/canvas'
import type { ActionManager } from '../loaders/ActionManager'
import type { ImageWindowLoader } from '../loaders/ImageLoader'
import { useDetachedLongText } from '../composables/useDetachedLongText'
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
import { NullCellRenderer } from './Null'
import { PlainCellRenderer } from './Plain'

const CLEANUP_INTERVAL = 1000

export function useGridCellHandler(params: {
  getCellPosition: (
    column: CanvasGridColumn,
    rowIndex: number,
    path: Array<number>,
  ) => { x: number; y: number; width: number; height: number }
  actionManager: ActionManager
  makeCellEditable: MakeCellEditableFn
  updateOrSaveRow: (
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
    beforeRow?: string,
    path?: Array<number>,
  ) => Promise<any>
  meta?: Ref<TableType>
  hasEditPermission: ComputedRef<boolean>
  setCursor: SetCursorType
}) {
  const isPublic = inject(IsPublicInj, ref(false))

  const { t } = useI18n()
  const { metas } = useMetas()
  const { user } = useGlobal()
  const canvasCellEvents = reactive<CanvasCellEventDataInjType>({})
  provide(CanvasCellEventDataInj, canvasCellEvents)

  const { isColumnSortedOrFiltered, appearanceConfig: filteredOrSortedAppearanceConfig } = useColumnFilteredOrSorted()

  const { isRowColouringEnabled } = useViewRowColorRender()

  const baseStore = useBase()
  const { showNull, appInfo } = useGlobal()
  const { isMysql, isXcdbBase, isPg } = baseStore
  const { sqlUis } = storeToRefs(baseStore)

  const { basesUser, baseRoles } = storeToRefs(useBases())

  const { open: openDetachedExpandedForm } = useExpandedFormDetached()
  const { open: openDetachedLongText } = useDetachedLongText()

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
      renderAsPlainCell = false,
      isUnderLookup = false,
      path = [],
      fontFamily,
      isRowHovered = false,
      isRowChecked = false,
      isCellInSelectionRange = false,
      isGroupHeader = false,
      rowMeta = {},
      isRootCell = false,
    }: Omit<CellRendererOptions, 'metas' | 'isMysql' | 'isXcdbBase' | 'sqlUis' | 'baseUsers' | 'isPg'>,
  ) => {
    if (skipRender) return
    if (!isGroupHeader) {
      const columnState = isColumnSortedOrFiltered(column.id!)
      if (!isRowColouringEnabled.value && columnState !== undefined && !rowMeta?.isValidationFailed) {
        let bgColorProps: 'cellBgColor' | 'cellBgColor.hovered' | 'cellBgColor.selected' = 'cellBgColor'
        let borderColorProps: 'cellBorderColor' | 'cellBorderColor.hovered' | 'cellBorderColor.selected' = 'cellBorderColor'
        if (selected || isRowChecked || isCellInSelectionRange) {
          bgColorProps = 'cellBgColor.selected'
          borderColorProps = 'cellBorderColor.selected'
        } else if (isRowHovered) {
          bgColorProps = 'cellBgColor.hovered'
          borderColorProps = 'cellBorderColor.hovered'
        }

        roundedRect(ctx, x, y, width, height, 0, {
          backgroundColor: filteredOrSortedAppearanceConfig[columnState][bgColorProps],
          borderColor: filteredOrSortedAppearanceConfig[columnState][borderColorProps],
          borderWidth: 0.4,
          borders: {
            top: rowMeta.rowIndex !== 0,
            right: true,
            bottom: true,
            left: true,
          },
        })
      } else if (!rowMeta?.isValidationFailed && isRootCell) {
        const rowColor =
          rowMeta?.is_set_as_background && (selected || isRowHovered || isRowChecked || isCellInSelectionRange)
            ? rowMeta?.rowHoverColor
            : rowMeta?.rowBgColor

        if (rowColor) {
          roundedRect(ctx, x, y, width, height, 0, {
            backgroundColor: rowColor,
            borderColor: themeV3Colors.gray['200'],
            borderWidth: 0.4,
            borders: {
              top: rowMeta.rowIndex !== 0,
              right: true,
              bottom: true,
              left: true,
            },
          })
        }
      }
    }
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

    let cellRenderer: CellRenderFn
    const shouldRenderNull = showNull.value && isShowNullField(column) && (ncIsUndefined(value) || ncIsNull(value))

    if (renderAsPlainCell) {
      cellRenderer = PlainCellRenderer.render
    } else if (cellType) {
      if (!shouldRenderNull) {
        cellRenderer = cellType.render
      } else {
        if (cellType.renderEmpty) {
          cellRenderer = cellType.renderEmpty
        } else {
          cellRenderer = NullCellRenderer.render
        }
      }
    } else if (shouldRenderNull) {
      cellRenderer = NullCellRenderer.render
    }

    if (cellRenderer!) {
      return cellRenderer(ctx, {
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
        user: user.value,
        isUnderLookup,
        isPublic: isPublic.value,
        path,
        fontFamily,
        isRowHovered,
        isRowChecked,
        rowMeta,
        allowLocalUrl: appInfo.value?.allowLocalUrl,
      })
    } else {
      return renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text: value?.toString() ?? '',
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
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
    path: Array<number>
  }) => {
    if (!ctx.column?.columnObj?.uidt) return
    const cellHandler = cellTypesRegistry.get(ctx.column.columnObj.uidt)

    const cellRenderStore = getCellRenderStore(`${ctx.column.id}-${ctx.pk}`)
    canvasCellEvents.keyboardKey = ''
    canvasCellEvents.event = undefined

    if (cellHandler?.handleClick) {
      return await cellHandler.handleClick({
        ...ctx,
        cellRenderStore,
        isDoubleClick: ctx.event.detail === 2,
        getCellPosition: (...args) => params?.getCellPosition?.(...args, ctx.path),
        readonly: !params.hasEditPermission.value,
        updateOrSaveRow: params?.updateOrSaveRow,
        actionManager,
        makeCellEditable: (row, clickedColumn, showEditCellRestrictionTooltip = ctx.event.detail === 2) =>
          makeCellEditable(row, clickedColumn, showEditCellRestrictionTooltip),
        isPublic: isPublic.value,
        openDetachedExpandedForm,
        openDetachedLongText,
        path: ctx.path ?? [],
        allowLocalUrl: appInfo.value?.allowLocalUrl,
        baseRoles: baseRoles.value,
        t,
      })
    }
    return false
  }

  const handleCellKeyDown = async (ctx: {
    e: KeyboardEvent
    row: Row
    column: CanvasGridColumn
    value: any
    pk: any
    path: Array<number>
  }) => {
    const cellHandler = cellTypesRegistry.get(ctx.column.columnObj!.uidt!)

    const cellRenderStore = getCellRenderStore(`${ctx.column.id}-${ctx.pk}`)
    canvasCellEvents.keyboardKey = ctx.e.key
    canvasCellEvents.event = ctx.e
    if (cellHandler?.handleKeyDown) {
      return await cellHandler.handleKeyDown({
        ...ctx,
        cellRenderStore,
        readonly: !params.hasEditPermission.value,
        updateOrSaveRow: params?.updateOrSaveRow,
        actionManager,
        makeCellEditable,
        openDetachedLongText,
        allowLocalUrl: appInfo.value?.allowLocalUrl,
        path: ctx.path ?? [],
        t,
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
    path: Array<number>
  }) => {
    if (!ctx.column?.columnObj?.uidt) return

    const cellHandler = cellTypesRegistry.get(ctx.column.columnObj.uidt)

    const cellRenderStore = getCellRenderStore(`${ctx.column.id}-${ctx.pk}`)
    canvasCellEvents.keyboardKey = ''
    if (cellHandler?.handleHover) {
      return await cellHandler.handleHover({
        ...ctx,
        cellRenderStore,
        getCellPosition: (...args) => params?.getCellPosition?.(...args, ctx.path),
        updateOrSaveRow: params?.updateOrSaveRow,
        actionManager,
        makeCellEditable,
        setCursor,
        path: ctx.path ?? [],
        baseUsers: baseUsers.value,
        t,
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
