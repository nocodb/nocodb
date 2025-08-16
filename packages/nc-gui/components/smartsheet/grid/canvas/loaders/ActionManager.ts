import type { Api, ButtonType, TableType } from 'nocodb-sdk'

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

  private eventBus?: any

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
  ) {
    this.api = api
    this.loadAutomation = loadAutomation
    this.generateRows = generateRows
    this.meta = meta
    this.triggerRefreshCanvas = triggerRefreshCanvas
    this.getDataCache = getDataCache
    this.eventBus = eventBus

    if (this.eventBus) {
      this.eventBus.on((event, payload) => {
        switch (event) {
          case SmartsheetScriptActions.BULK_ACTION_START: {
            const columnId = payload.columnId
            this.activeBulkExecs.set(columnId, true)
            this.startAnimationLoop()
            break
          }
          case SmartsheetScriptActions.BULK_ACTION_END: {
            if (payload.columnId) {
              this.activeBulkExecs.delete(payload.columnId)
              this.clearBulkRowStatesForColumn(payload.columnId)
            }
            break
          }
          case SmartsheetScriptActions.BUTTON_ACTION_START: {
            const columnId = payload.columnId
            const rowId = payload.rowId

            // Set individual row to loading state
            this.setBulkRowState(rowId, columnId, {
              status: 'loading',
              startTime: Date.now(),
              stepTitle: payload.stepTitle,
            })
            break
          }
          case SmartsheetScriptActions.BUTTON_ACTION_PROGRESS: {
            console.log('BUTTON_ACTION_PROGRESS', payload)
            // Update step title for the specific row
            const rowState = this.getBulkRowState(payload.rowId, payload.columnId)
            if (rowState) {
              this.setBulkRowState(payload.rowId, payload.columnId, {
                ...rowState,
                stepTitle: payload.stepTitle,
              })
            }
            break
          }
          case SmartsheetScriptActions.BUTTON_ACTION_COMPLETE: {
            // Set individual row to success/error state
            this.setBulkRowState(payload.rowId, payload.columnId, {
              status: payload.success ? 'success' : 'error',
              error: payload.error,
            })
            break
          }
          case SmartsheetScriptActions.BUTTON_ACTION_ERROR: {
            // Set individual row to error state
            this.setBulkRowState(payload.rowId, payload.columnId, {
              status: 'error',
              error: payload.error,
            })
            break
          }
          case SmartsheetScriptActions.UPDATE_STEP_TITLE: {
            this.setCurrentStepTitle(payload.pk, payload.fieldId, payload.title)
            break
          }
          case SmartsheetScriptActions.START_CELL_UPDATE: {
            this.startCellUpdate(payload.recordId, payload.fieldId, payload.fieldName, payload.scriptId)
            break
          }
          case SmartsheetScriptActions.COMPLETE_CELL_UPDATE: {
            this.completeCellUpdate(payload.recordId, payload.fieldId)
            break
          }
          case SmartsheetScriptActions.CLEAR_SCRIPT_CELL_UPDATES: {
            this.clearScriptCellUpdates(payload.scriptId)
            break
          }
        }
      })
    }
  }

  private loadingColumns = new Map<string, number>()
  private afterActionStatus = new Map<
    string,
    {
      status: 'success' | 'error'
      tooltip?: string
    }
  >()

  // key is rowId-columnId, value is current step title
  private currentStepTitles = new Map<string, string>()
  private cellUpdates = new Map<string, { fieldName: string; scriptExecutionId: string; startTime: number }>()

  // Track active bulk executions by column
  private activeBulkExecs = new Map<string, boolean>() // columnId -> isActive

  private bulkRowStates = new Map<
    string,
    {
      status: 'queued' | 'loading' | 'success' | 'error'
      startTime?: number
      stepTitle?: string
      error?: string
    }
  >()

  private rafId: number | null = null

  private getKey(rowId: string, columnId: string): string {
    return `${rowId}-${columnId}`
  }

  private async executeAction(
    rowId: string | string[],
    columnId: string,
    affectedColumnIds: string[] = [],
    action: () => Promise<any>,
  ) {
    const startTime = Date.now()

    const rowIds = Array.isArray(rowId) ? rowId : [rowId]

    rowIds.forEach((id) => {
      this.loadingColumns.set(this.getKey(id, columnId), startTime)

      // If action is triggered again, clear after action status
      this.afterActionStatus.delete(this.getKey(id, columnId))

      affectedColumnIds.forEach((colId) => {
        this.loadingColumns.set(this.getKey(id, colId), startTime)

        // If action is triggered again, clear after action status
        this.afterActionStatus.delete(this.getKey(id, colId))
      })
    })

    this.startAnimationLoop()

    let isErrorOccured = false

    try {
      const res = await action()

      rowIds.forEach((id) => {
        this.afterActionStatus.set(this.getKey(id, columnId), { status: 'success' })

        affectedColumnIds.forEach((colId) => {
          this.afterActionStatus.set(this.getKey(id, colId), { status: 'success' })
        })
      })

      return res
    } catch (e: any) {
      isErrorOccured = true

      const errorMsg = await extractSdkResponseErrorMsg(e)
      rowIds.forEach((id) => {
        this.afterActionStatus.set(this.getKey(id, columnId), { status: 'error', tooltip: errorMsg ?? 'Something went wrong' })

        affectedColumnIds.forEach((colId) => {
          this.afterActionStatus.set(this.getKey(id, colId), { status: 'error', tooltip: errorMsg ?? 'Something went wrong' })
        })
      })

      throw e
    } finally {
      rowIds.forEach((id) => {
        this.loadingColumns.delete(this.getKey(id, columnId))
        this.currentStepTitles.delete(this.getKey(id, columnId))

        affectedColumnIds.forEach((colId) => {
          this.loadingColumns.delete(this.getKey(id, colId))
          this.currentStepTitles.delete(this.getKey(id, colId))
        })
      })

      // Remove error columns after 3 seconds if error occured, otherwise after 2 seconds
      ncDelay(isErrorOccured ? 3000 : 2000).then(() => {
        rowIds.forEach((id) => {
          this.afterActionStatus.delete(this.getKey(id, columnId))

          affectedColumnIds.forEach((colId) => {
            this.afterActionStatus.delete(this.getKey(id, colId))
          })
        })
      })
    }
  }

  private startAnimationLoop() {
    const hasActivity = this.loadingColumns.size > 0 || this.afterActionStatus.size > 0 || this.activeBulkExecs.size > 0

    if (this.rafId === null && hasActivity) {
      let cooldownTimeout: number | null = null
      let isCoolingDown = false

      const animate = () => {
        const currentActivity = this.loadingColumns.size > 0 || this.afterActionStatus.size > 0 || this.activeBulkExecs.size > 0

        if (currentActivity && cooldownTimeout) {
          clearTimeout(cooldownTimeout)
          cooldownTimeout = null
          isCoolingDown = false
        }

        if (currentActivity) {
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

          this.rafId = requestAnimationFrame(() => {
            this.triggerRefreshCanvas()
          })
        }
      }

      this.rafId = requestAnimationFrame(animate)
    }
  }

  private handleUrl(colOptions: any, url: string, allowLocalUrl: boolean) {
    url = addMissingUrlSchma(url)

    try {
      url = decodeURI(url) === url ? encodeURI(url) : url
    } catch {
      url = encodeURI(url)
    }

    if (url) {
      confirmPageLeavingRedirect(url, '_blank', allowLocalUrl)
    }
  }

  private getRecordDisplayValue(row?: Record<string, any>): string {
    if (!row) return ''

    const displayField = this.meta.value?.columns?.find((col) => col.pv) || this.meta.value?.columns?.find((col) => col.pk)

    if (displayField && row.row[displayField.title!]) {
      return String(row.row[displayField.title!])
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
      path: Array<number>
      allowLocalUrl?: boolean
    },
  ) {
    const colOptions = column?.columnObj.colOptions as ButtonType
    if (!colOptions) return

    if (!extra.path) {
      extra.path = []
    }

    const { cachedRows } = this.getDataCache(extra.path)

    if (column.isInvalidColumn?.isInvalid) {
      return
    }

    if (extra?.isAiPromptCol) {
      colOptions.type = 'ai'
    }

    const { runScript, activeExecutions } = useScriptExecutor()
    const { addScriptExecution } = useActionPane()

    try {
      switch (colOptions.type) {
        case 'url': {
          const value = extra?.row?.[0]?.row?.[column.columnObj.title]
          this.handleUrl(colOptions, value?.url?.toString() ?? '', extra.allowLocalUrl)
          break
        }
        case 'webhook': {
          const webhookId = colOptions.fk_webhook_id
          if (!webhookId) throw new Error('No webhook configured')

          for (const rowId of rowIds) {
            await this.executeAction(rowId, column.id, [], async () => {
              await this.api.dbTableWebhook.trigger(webhookId, rowId)
            })
          }
          break
        }
        case 'script': {
          const script = await this.loadAutomation(colOptions.fk_script_id)
          for (let i = 0; i < rowIds.length; i++) {
            const rowId = rowIds[i]!
            const row = extra?.row?.[i]

            const displayValue = this.getRecordDisplayValue(row) || `Record ${rowId}`

            this.executeAction(rowId, column.id, [], async () => {
              try {
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
                // The script returns once it is added to the executionQueue
                // Here we wait for the script to finish or error via polling
                await pollUntil(
                  () =>
                    activeExecutions.value.get(scriptExecutionId)?.status === 'finished' ||
                    activeExecutions.value.get(scriptExecutionId)?.status === 'error',
                )
              } catch (error) {
                throw error
              }
            })
          }
          break
        }
        case 'ai': {
          const outputColumnIds = extra?.isAiPromptCol
            ? [column.id]
            : colOptions.output_column_ids?.split(',').filter(Boolean) || []
          const outputColumns = outputColumnIds.map((id) => this.meta.value?.columnsById[id])

          await this.executeAction(rowIds, column.id, outputColumnIds, async () => {
            const res = await this.generateRows(column.id, rowIds)

            if (res?.length) {
              for (let i = 0; i < res.length; i++) {
                const row = cachedRows.value.get(extra?.row?.[i]?.rowMeta?.rowIndex)
                if (row) {
                  const data = res[i]
                  for (const col of outputColumns) {
                    row.row[col.title] = data[col.title]
                  }
                  cachedRows.value.set(extra?.row?.[i]?.rowMeta?.rowIndex, row)
                }
              }
            }
          })
          break
        }
      }
    } catch (e: any) {
      console.error('Error executing button action', e)
    }
  }

  isLoading(rowId: string, columnId: string): boolean {
    const key = this.getKey(rowId, columnId)
    const isDirectLoading = this.loadingColumns.has(key)
    const bulkRowState = this.getBulkRowState(rowId, columnId)
    const isBulkLoading = bulkRowState?.status === 'loading'

    return isDirectLoading || isBulkLoading
  }

  getLoadingStartTime(rowId: string, columnId: string): number | null {
    const key = this.getKey(rowId, columnId)
    const directLoadingTime = this.loadingColumns.get(key)
    const bulkRowState = this.getBulkRowState(rowId, columnId)
    const bulkLoadingTime = bulkRowState?.startTime

    return directLoadingTime ?? bulkLoadingTime ?? null
  }

  getAfterActionStatus(rowId: string, columnId: string) {
    const key = this.getKey(rowId, columnId)
    const directStatus = this.afterActionStatus.get(key)

    if (directStatus) {
      return directStatus
    }

    // Check bulk row state for success/error
    const bulkRowState = this.getBulkRowState(rowId, columnId)
    if (bulkRowState?.status === 'success') {
      return { status: 'success' as const }
    } else if (bulkRowState?.status === 'error') {
      return { status: 'error' as const, tooltip: bulkRowState.error ?? 'Something went wrong' }
    }

    return undefined
  }

  isQueued(rowId: string, columnId: string): boolean {
    const isBulkExecutionRunning = this.isBulkExecutionRunning(columnId)

    const key = this.getKey(rowId, columnId)
    return isBulkExecutionRunning && !this.bulkRowStates.has(key)
  }

  getCurrentStepTitle(rowId: string, columnId: string): string | undefined {
    const key = this.getKey(rowId, columnId)
    const directStepTitle = this.currentStepTitles.get(key)
    const bulkRowState = this.getBulkRowState(rowId, columnId)

    // Return bulk step title if available, otherwise direct step title
    return bulkRowState?.stepTitle ?? directStepTitle
  }

  setCurrentStepTitle(rowId: string, columnId: string, title: string) {
    this.currentStepTitles.set(this.getKey(rowId, columnId), title)
  }

  clearCurrentStepTitle(rowId: string, columnId: string) {
    this.currentStepTitles.delete(this.getKey(rowId, columnId))
  }

  startCellUpdate(recordId: string, fieldId: string, fieldName: string, scriptExecutionId: string) {
    const cellKey = `${recordId}:${fieldId}`
    this.cellUpdates.set(cellKey, { fieldName, scriptExecutionId, startTime: Date.now() })
  }

  completeCellUpdate(recordId: string, fieldId: string) {
    const cellKey = `${recordId}:${fieldId}`
    this.cellUpdates.delete(cellKey)
  }

  getCellUpdateStartTime(recordId: string, fieldId: string): number | null {
    const cellKey = `${recordId}:${fieldId}`
    return this.cellUpdates.get(cellKey)?.startTime ?? null
  }

  isCellUpdating(recordId: string, fieldId: string): boolean {
    const cellKey = `${recordId}:${fieldId}`
    return this.cellUpdates.has(cellKey)
  }

  clearScriptCellUpdates(scriptExecutionId: string) {
    for (const [key, value] of this.cellUpdates.entries()) {
      if (value.scriptExecutionId === scriptExecutionId) {
        this.cellUpdates.delete(key)
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

  isBulkExecutionRunning(columnId: string): boolean {
    return this.activeBulkExecs.get(columnId) ?? false
  }

  getBulkRowState(
    rowId: string,
    columnId: string,
  ):
    | {
        status: 'queued' | 'loading' | 'success' | 'error'
        startTime?: number
        stepTitle?: string
        error?: string
      }
    | undefined {
    const key = this.getKey(rowId, columnId)
    return this.bulkRowStates.get(key)
  }

  setBulkRowState(
    rowId: string,
    columnId: string,
    state: {
      status: 'queued' | 'loading' | 'success' | 'error'
      startTime?: number
      stepTitle?: string
      error?: string
    },
  ) {
    const key = this.getKey(rowId, columnId)
    this.bulkRowStates.set(key, state)
  }

  clearBulkRowState(rowId: string, columnId: string) {
    const key = this.getKey(rowId, columnId)
    this.bulkRowStates.delete(key)
  }

  clearBulkRowStatesForColumn(columnId: string) {
    for (const [key, value] of this.bulkRowStates.entries()) {
      if (key.endsWith(`-${columnId}`)) {
        this.bulkRowStates.delete(key)
      }
    }
  }
}
