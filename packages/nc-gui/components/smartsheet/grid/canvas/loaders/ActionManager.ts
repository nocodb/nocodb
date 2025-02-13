import type { TableType } from 'nocodb-sdk'

export class ActionManager {
  private api: ReturnType<typeof createApiInstance>
  private loadAutomation: (id: string) => Promise<any>
  private generateRows: (columnId: string, rowIds: string[]) => Promise<Array<Record<string, any>>>
  private triggerRefreshCanvas: () => void
  private meta: Ref<TableType>
  private cachedRows: Ref<Map<number, Row>>
  constructor(
    api: ReturnType<typeof createApiInstance>,
    loadAutomation: (id: string) => Promise<any>,
    generateRows: (columnId: string, rowIds: string[]) => Promise<Array<Record<string, any>>>,
    meta: Ref<TableType>,
    cachedRows: Ref<Map<number, Row>>,
    triggerRefreshCanvas: () => void,
  ) {
    this.api = api
    this.loadAutomation = loadAutomation
    this.generateRows = generateRows
    this.meta = meta
    this.cachedRows = cachedRows
    this.triggerRefreshCanvas = triggerRefreshCanvas
  }

  // key is rowId-columnId, value is startTime
  private loadingColumns = new Map<string, number>()
  private rafId: number | null = null

  private getKey(rowId: string, columnId: string): string {
    return `${rowId}-${columnId}`
  }

  private async executeAction(rowId: string, columnId: string, affectedColumnIds: string[] = [], action: () => Promise<any>) {
    const startTime = Date.now()

    this.loadingColumns.set(this.getKey(rowId, columnId), startTime)

    affectedColumnIds.forEach((colId) => {
      this.loadingColumns.set(this.getKey(rowId, colId), startTime)
    })
    this.startAnimationLoop()
    try {
      return await action()
    } finally {
      this.loadingColumns.delete(this.getKey(rowId, columnId))
      affectedColumnIds.forEach((colId) => {
        this.loadingColumns.delete(this.getKey(rowId, colId))
      })
    }
  }

  private startAnimationLoop() {
    if (this.rafId === null && this.loadingColumns.size > 0) {
      let cooldownTimeout: number | null = null

      const animate = () => {
        if (this.loadingColumns.size > 0) {
          if (cooldownTimeout) {
            clearTimeout(cooldownTimeout)
            cooldownTimeout = null
          }
          this.triggerRefreshCanvas()
          this.rafId = requestAnimationFrame(animate)
        } else {
          if (!cooldownTimeout) {
            cooldownTimeout = window.setTimeout(() => {
              this.rafId = null
            }, 1000)
          }
          this.triggerRefreshCanvas()
          this.rafId = requestAnimationFrame(animate)
        }
      }
      this.rafId = requestAnimationFrame(animate)
    }
  }

  private handleUrl(colOptions: any, url: string) {
    url = /^(https?|ftp|mailto|file):\/\//.test(url) ? url : url.trim() ? `https://${url}` : ''

    try {
      url = decodeURI(url) === url ? encodeURI(url) : url
    } catch {
      url = encodeURI(url)
    }

    if (url) {
      window.open(url, '_blank')
    }
  }

  async executeButtonAction(
    rowId: string,
    column: CanvasGridColumn,
    extra: {
      row?: Row
    },
  ) {
    const colOptions = column?.columnObj.colOptions
    if (!colOptions) return

    const { runScript } = useScriptExecutor()

    try {
      switch (colOptions.type) {
        case 'url': {
          const value = extra?.row?.row?.[column.columnObj.title]
          this.handleUrl(colOptions, value?.url)
          break
        }
        case 'webhook': {
          const webhookId = colOptions.fk_webhook_id
          if (!webhookId) throw new Error('No webhook configured')

          await this.executeAction(rowId, column.id, [], async () => {
            await this.api.dbTableWebhook.trigger(webhookId, rowId)
          })
          break
        }
        case 'script': {
          const script = await this.loadAutomation(colOptions.fk_script_id)
          await runScript(script, extra?.row, {
            pk: rowId,
            fieldId: column.columnObj.id!,
          })
          break
        }
        case 'ai': {
          const outputColumnIds = colOptions.output_column_ids?.split(',').filter(Boolean) || []
          const outputColumns = outputColumnIds.map((id) => this.meta.value?.columnsById[id])

          await this.executeAction(rowId, column.id, outputColumnIds, async () => {
            const res = await this.generateRows(column.id, [rowId])
            const row = this.cachedRows.value.get(extra?.row?.rowMeta?.rowIndex)

            if (res?.length) {
              const data = res[0]
              for (const col of outputColumns) {
                row.row[col.title] = data[col.title]
              }

              this.cachedRows.value.set(extra?.row?.rowMeta?.rowIndex, row)
            }
          })
          break
        }
      }
    } catch (e) {
      console.error('Error executing button action', e)
    }
  }

  isLoading(rowId: string, columnId: string): boolean {
    return this.loadingColumns.has(this.getKey(rowId, columnId))
  }

  getLoadingStartTime(rowId: string, columnId: string): number | null {
    return this.loadingColumns.get(this.getKey(rowId, columnId)) ?? null
  }

  clear() {
    this.loadingColumns.clear()
  }
}
