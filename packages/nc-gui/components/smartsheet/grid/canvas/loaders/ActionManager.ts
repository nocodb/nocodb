import type { Api, ButtonType, TableType } from 'nocodb-sdk'
import type { UserObject } from 'packages/nc-gui/composables/useUserSync'

interface ActionState {
  status: 'loading' | 'success' | 'error' | 'queued'
  startTime?: number
  stepTitle?: string
  error?: string
}

interface BulkRowState extends ActionState {
  status: 'queued' | 'loading' | 'success' | 'error'
}

interface CellUpdate {
  fieldName: string
  scriptExecutionId: string
  startTime: number
}

export class ActionManager {
  private api: Api<any>
  private readonly loadAutomation: (id: string) => Promise<any>
  private readonly generateRows: (columnId: string, rowIds: string[]) => Promise<Array<Record<string, any>>>
  private readonly triggerRefreshCanvas: () => void
  private meta: Ref<TableType>
  private readonly getDataCache: (path?: Array<number>) => {
    cachedRows: Ref<Map<number, Row>>
    totalRows: Ref<number>
    chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
    selectedRows: ComputedRef<Array<Row>>
    isRowSortRequiredRows: ComputedRef<Array<Row>>
  }

  private readonly userSync: Ref<UserObject>

  private eventBus?: any

  // Consolidated state maps
  private loadingColumns = new Map<string, number>()
  private afterActionStatus = new Map<string, Omit<ActionState, 'startTime'>>()
  private currentStepTitles = new Map<string, string>()
  private cellUpdates = new Map<string, CellUpdate>()
  private activeBulkExecs = new Map<string, boolean>()
  private bulkRowStates = new Map<string, BulkRowState>()
  private rafId: number | null = null

  constructor(
    api: Api<any>,
    loadAutomation: (id: string) => Promise<any>,
    generateRows: (columnId: string, rowIds: string[]) => Promise<Array<Record<string, any>>>,
    meta: Ref<TableType>,
    triggerRefreshCanvas: () => void,
    getDataCache: (path?: Array<number>) => {
      cachedRows: Ref<Map<number, Row>>
      totalRows: Ref<number>
      chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
      selectedRows: ComputedRef<Array<Row>>
      isRowSortRequiredRows: ComputedRef<Array<Row>>
    },
    eventBus?: any,
    userSync?: any,
  ) {
    this.api = api
    this.loadAutomation = loadAutomation
    this.generateRows = generateRows
    this.meta = meta
    this.triggerRefreshCanvas = triggerRefreshCanvas
    this.getDataCache = getDataCache
    this.eventBus = eventBus
    this.userSync = userSync

    this.setupEventListeners()
  }

  private eventMap = {
    [SmartsheetScriptActions.BULK_ACTION_START]: (payload: any) => {
      this.activeBulkExecs.set(payload.columnId, true)
      this.startAnimationLoop()
    },
    [SmartsheetScriptActions.BULK_ACTION_END]: (payload: any) => {
      if (payload.columnId) {
        this.activeBulkExecs.delete(payload.columnId)
        this.clearBulkRowStatesForColumn(payload.columnId)
      }
    },
    [SmartsheetScriptActions.BUTTON_ACTION_START]: (payload: any) => {
      this.setBulkRowState(payload.rowId, payload.columnId, {
        status: 'loading',
        startTime: Date.now(),
        stepTitle: payload.stepTitle,
      })
    },
    [SmartsheetScriptActions.BUTTON_ACTION_PROGRESS]: (payload: any) => {
      console.log('BUTTON_ACTION_PROGRESS', payload)
      const rowState = this.getBulkRowState(payload.rowId, payload.columnId)
      if (rowState) {
        this.setBulkRowState(payload.rowId, payload.columnId, {
          ...rowState,
          stepTitle: payload.stepTitle,
        })
      }
    },
    [SmartsheetScriptActions.BUTTON_ACTION_COMPLETE]: (payload: any) => {
      this.setBulkRowState(payload.rowId, payload.columnId, {
        status: payload.success ? 'success' : 'error',
        error: payload.error,
      })
    },
    [SmartsheetScriptActions.BUTTON_ACTION_ERROR]: (payload: any) => {
      this.setBulkRowState(payload.rowId, payload.columnId, {
        status: 'error',
        error: payload.error,
      })
    },
    [SmartsheetScriptActions.UPDATE_STEP_TITLE]: (payload: any) => {
      this.setCurrentStepTitle(payload.pk, payload.fieldId, payload.title)
    },
    [SmartsheetScriptActions.START_CELL_UPDATE]: (payload: any) => {
      this.startCellUpdate(payload.recordId, payload.fieldId, payload.fieldName, payload.scriptId)
    },
    [SmartsheetScriptActions.COMPLETE_CELL_UPDATE]: (payload: any) => {
      this.completeCellUpdate(payload.recordId, payload.fieldId)
    },
    [SmartsheetScriptActions.CLEAR_SCRIPT_CELL_UPDATES]: (payload: any) => {
      this.clearScriptCellUpdates(payload.scriptId)
    },
  }

  private eventHandler = (event: string, payload: any) => {
    this.eventMap[event]?.(payload)
  }

  private setupEventListeners() {
    if (!this.eventBus) return
    this.eventBus.on(this.eventHandler)
  }

  public releaseEventListeners() {
    if (!this.eventBus) return
    this.eventBus.off(this.eventHandler)
  }

  private getKey(rowId: string, columnId: string): string {
    return `${rowId}-${columnId}`
  }

  private updateRowStates(rowIds: string[], columnId: string, affectedColumnIds: string[], updateFn: (key: string) => void) {
    rowIds.forEach((rowId) => {
      updateFn(this.getKey(rowId, columnId))
      affectedColumnIds.forEach((colId) => updateFn(this.getKey(rowId, colId)))
    })
  }

  private async executeAction(
    rowId: string | string[],
    columnId: string,
    affectedColumnIds: string[] = [],
    action: () => Promise<any>,
  ) {
    const startTime = Date.now()
    const rowIds = Array.isArray(rowId) ? rowId : [rowId]

    // Set loading state
    this.updateRowStates(rowIds, columnId, affectedColumnIds, (key) => {
      this.loadingColumns.set(key, startTime)
      this.afterActionStatus.delete(key)
    })

    this.startAnimationLoop()

    try {
      const res = await action()

      // Set success state
      this.updateRowStates(rowIds, columnId, affectedColumnIds, (key) => {
        this.afterActionStatus.set(key, { status: 'success' })
      })

      return res
    } catch (e: any) {
      const errorMsg = await extractSdkResponseErrorMsg(e)

      // Set error state
      this.updateRowStates(rowIds, columnId, affectedColumnIds, (key) => {
        this.afterActionStatus.set(key, {
          status: 'error',
          tooltip: errorMsg ?? 'Something went wrong',
        })
      })

      throw e
    } finally {
      // Clean up loading state
      this.updateRowStates(rowIds, columnId, affectedColumnIds, (key) => {
        this.loadingColumns.delete(key)
        this.currentStepTitles.delete(key)
      })

      // Clean up after action status with delay
      const isError = this.afterActionStatus.get(this.getKey(rowIds[0], columnId))?.status === 'error'
      ncDelay(isError ? 3000 : 2000).then(() => {
        this.updateRowStates(rowIds, columnId, affectedColumnIds, (key) => {
          this.afterActionStatus.delete(key)
        })
      })
    }
  }

  private startAnimationLoop() {
    const hasActivity = this.loadingColumns.size > 0 || this.afterActionStatus.size > 0 || this.activeBulkExecs.size > 0

    if (this.rafId !== null || !hasActivity) return

    let cooldownTimeout: number | null = null
    let isCoolingDown = false

    const animate = () => {
      const currentActivity = this.loadingColumns.size > 0 || this.afterActionStatus.size > 0 || this.activeBulkExecs.size > 0

      if (currentActivity) {
        if (cooldownTimeout) {
          clearTimeout(cooldownTimeout)
          cooldownTimeout = null
          isCoolingDown = false
        }
        this.triggerRefreshCanvas()
        this.rafId = requestAnimationFrame(animate)
      } else if (!isCoolingDown) {
        isCoolingDown = true
        this.triggerRefreshCanvas()

        cooldownTimeout = window.setTimeout(() => {
          if (this.rafId) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
          }
          cooldownTimeout = null
          isCoolingDown = false
        }, 1000)

        this.rafId = requestAnimationFrame(() => this.triggerRefreshCanvas())
      }
    }

    this.rafId = requestAnimationFrame(animate)
  }

  private handleUrl(colOptions: any, url: string, allowLocalUrl: boolean = false) {
    if (!url) return

    try {
      url = addMissingUrlSchma(url)
      url = decodeURI(url) === url ? encodeURI(url) : url
      confirmPageLeavingRedirect(url, '_blank', allowLocalUrl, this.userSync?.value)
    } catch {
      confirmPageLeavingRedirect(encodeURI(url), '_blank', allowLocalUrl, this.userSync?.value)
    }
  }

  private getRecordDisplayValue(row?: Record<string, any>): string {
    if (!row?.row) return ''

    const displayField = this.meta.value?.columns?.find((col) => col.pv || col.pk)
    if (displayField?.title && row.row[displayField.title]) {
      return String(row.row[displayField.title])
    }

    const firstValue = Object.values(row.row).find((val) => val !== null && val !== undefined && val !== '')
    return firstValue ? String(firstValue) : ''
  }

  async executeButtonAction(
    rowIds: string[],
    column: CanvasGridColumn,
    extra: {
      row?: Row[]
      isAiPromptCol?: boolean
      path?: Array<number>
      allowLocalUrl?: boolean
    } = {},
  ) {
    const colOptions = column?.columnObj.colOptions as ButtonType
    if (!colOptions || column.isInvalidColumn?.isInvalid) return

    extra.path = extra.path || []
    const { cachedRows } = this.getDataCache(extra.path)

    if (extra.isAiPromptCol) {
      colOptions.type = 'ai'
    }

    const { runScript, activeExecutions } = useScriptExecutor()
    const { addScriptExecution } = useActionPane()

    try {
      switch (colOptions.type) {
        case 'url': {
          const value = extra.row?.[0]?.row?.[column.columnObj.title]
          this.handleUrl(colOptions, value?.url?.toString() ?? '', extra.allowLocalUrl)
          break
        }

        case 'webhook': {
          const webhookId = colOptions.fk_webhook_id
          if (!webhookId) throw new Error('No webhook configured')

          for (const rowId of rowIds) {
            await this.executeAction(rowId, column.id, [], () => this.api.dbTableWebhook.trigger(webhookId, rowId))
          }
          break
        }

        case 'script': {
          const script = await this.loadAutomation(colOptions.fk_script_id)

          for (let i = 0; i < rowIds.length; i++) {
            const rowId = rowIds[i]!
            const row = extra.row?.[i]
            const displayValue = this.getRecordDisplayValue(row) || `Record ${rowId}`

            await this.executeAction(rowId, column.id, [], async () => {
              const scriptExecutionId = await runScript(script, row, {
                pk: rowId,
                fieldId: column.columnObj.id!,
                executionId: `${rowId}-${column.columnObj.id!}-${Date.now()}`,
              })

              addScriptExecution(scriptExecutionId, {
                recordId: rowId,
                displayValue,
                scriptId: script.id!,
                scriptName: script.title || 'Untitled Script',
                buttonFieldName: column.columnObj.title || 'Button',
              })

              await pollUntil(() => {
                const execution = activeExecutions.value.get(scriptExecutionId)
                return execution?.status === 'finished' || execution?.status === 'error'
              })
            })
          }
          break
        }

        case 'ai': {
          const outputColumnIds = extra.isAiPromptCol
            ? [column.id]
            : colOptions.output_column_ids?.split(',').filter(Boolean) || []

          const outputColumns = outputColumnIds.map((id) => this.meta.value?.columnsById[id])

          await this.executeAction(rowIds, column.id, outputColumnIds, async () => {
            const res = await this.generateRows(column.id, rowIds)

            if (res?.length) {
              res.forEach((data, i) => {
                const row = cachedRows.value.get(extra.row?.[i]?.rowMeta?.rowIndex)
                if (row) {
                  outputColumns.forEach((col) => {
                    if (col?.title) row.row[col.title] = data[col.title]
                  })
                  cachedRows.value.set(extra.row[i]?.rowMeta?.rowIndex, row)
                }
              })
            }
          })
          break
        }
      }
    } catch (e: any) {
      console.error('Error executing button action', e)
    }
  }

  async executeUploadAction(...args: Parameters<typeof this.executeAction>): Promise<ReturnType<typeof this.executeAction>> {
    return this.executeAction(...args)
  }

  // Public state query methods
  isLoading(rowId: string, columnId: string): boolean {
    const key = this.getKey(rowId, columnId)
    return this.loadingColumns.has(key) || this.getBulkRowState(rowId, columnId)?.status === 'loading'
  }

  getLoadingStartTime(rowId: string, columnId: string): number | null {
    const key = this.getKey(rowId, columnId)
    return this.loadingColumns.get(key) ?? this.getBulkRowState(rowId, columnId)?.startTime ?? null
  }

  getAfterActionStatus(rowId: string, columnId: string) {
    const key = this.getKey(rowId, columnId)
    const directStatus = this.afterActionStatus.get(key)

    if (directStatus) return directStatus

    const bulkState = this.getBulkRowState(rowId, columnId)
    if (bulkState?.status === 'success') return { status: 'success' as const }
    if (bulkState?.status === 'error') {
      return { status: 'error' as const, tooltip: bulkState.error ?? 'Something went wrong' }
    }

    return undefined
  }

  isQueued(rowId: string, columnId: string): boolean {
    return this.isBulkExecutionRunning(columnId) && !this.bulkRowStates.has(this.getKey(rowId, columnId))
  }

  getCurrentStepTitle(rowId: string, columnId: string): string | undefined {
    const key = this.getKey(rowId, columnId)
    return this.getBulkRowState(rowId, columnId)?.stepTitle ?? this.currentStepTitles.get(key)
  }

  setCurrentStepTitle(rowId: string, columnId: string, title: string) {
    this.currentStepTitles.set(this.getKey(rowId, columnId), title)
  }

  clearCurrentStepTitle(rowId: string, columnId: string) {
    this.currentStepTitles.delete(this.getKey(rowId, columnId))
  }

  // Cell update methods
  startCellUpdate(recordId: string, fieldId: string, fieldName: string, scriptExecutionId: string) {
    this.cellUpdates.set(`${recordId}:${fieldId}`, {
      fieldName,
      scriptExecutionId,
      startTime: Date.now(),
    })
  }

  completeCellUpdate(recordId: string, fieldId: string) {
    this.cellUpdates.delete(`${recordId}:${fieldId}`)
  }

  getCellUpdateStartTime(recordId: string, fieldId: string): number | null {
    return this.cellUpdates.get(`${recordId}:${fieldId}`)?.startTime ?? null
  }

  isCellUpdating(recordId: string, fieldId: string): boolean {
    return this.cellUpdates.has(`${recordId}:${fieldId}`)
  }

  clearScriptCellUpdates(scriptExecutionId: string) {
    for (const [key, value] of this.cellUpdates.entries()) {
      if (value.scriptExecutionId === scriptExecutionId) {
        this.cellUpdates.delete(key)
      }
    }
  }

  // Bulk execution methods
  isBulkExecutionRunning(columnId: string): boolean {
    return this.activeBulkExecs.get(columnId) ?? false
  }

  getBulkRowState(rowId: string, columnId: string): BulkRowState | undefined {
    return this.bulkRowStates.get(this.getKey(rowId, columnId))
  }

  setBulkRowState(rowId: string, columnId: string, state: BulkRowState) {
    this.bulkRowStates.set(this.getKey(rowId, columnId), state)
  }

  clearBulkRowState(rowId: string, columnId: string) {
    this.bulkRowStates.delete(this.getKey(rowId, columnId))
  }

  clearBulkRowStatesForColumn(columnId: string) {
    for (const [key] of this.bulkRowStates.entries()) {
      if (key.endsWith(`-${columnId}`)) {
        this.bulkRowStates.delete(key)
      }
    }
  }

  clear() {
    this.loadingColumns.clear()
    this.currentStepTitles.clear()
    this.cellUpdates.clear()
    this.activeBulkExecs.clear()
    this.bulkRowStates.clear()
  }
}
