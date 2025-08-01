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
  ) {
    this.api = api
    this.loadAutomation = loadAutomation
    this.generateRows = generateRows
    this.meta = meta
    this.triggerRefreshCanvas = triggerRefreshCanvas
    this.getDataCache = getDataCache
  }

  // key is rowId-columnId, value is startTime
  private loadingColumns = new Map<string, number>()
  private afterActionStatus = new Map<
    string,
    {
      status: 'success' | 'error'
      tooltip?: string
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
        this.afterActionStatus.delete(this.getKey(id, columnId))
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

        affectedColumnIds.forEach((colId) => {
          this.loadingColumns.delete(this.getKey(id, colId))
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
    if (this.rafId === null && (this.loadingColumns.size > 0 || this.afterActionStatus.size > 0)) {
      let cooldownTimeout: number | null = null
      let isCoolingDown = false

      const animate = () => {
        if ((this.loadingColumns.size > 0 || this.afterActionStatus.size > 0) && cooldownTimeout) {
          clearTimeout(cooldownTimeout)
          cooldownTimeout = null
          isCoolingDown = false
        }

        if (this.loadingColumns.size > 0 || this.afterActionStatus.size > 0) {
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

    const { runScript } = useScriptExecutor()

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
            this.executeAction(rowIds[i]!, column.id, [], async () => {
              await runScript(script, extra?.row?.[i], {
                pk: rowIds[i]!,
                fieldId: column.columnObj.id!,
              })
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
    return this.loadingColumns.has(this.getKey(rowId, columnId))
  }

  getLoadingStartTime(rowId: string, columnId: string): number | null {
    return this.loadingColumns.get(this.getKey(rowId, columnId)) ?? null
  }

  getAfterActionStatus(rowId: string, columnId: string) {
    return this.afterActionStatus.get(this.getKey(rowId, columnId))
  }

  clear() {
    this.loadingColumns.clear()
  }
}
