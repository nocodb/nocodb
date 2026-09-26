import type { ColumnType } from 'nocodb-sdk'

export type FieldAgentRunMode = 'all' | 'unmodified' | 'modified'

export interface FieldAgentBulkStats {
  columnName: string
  mode: FieldAgentRunMode
  rowsRequested: number
  rowsProcessed: number
  rowsFailed: number
  durationMs: number
  status: 'success' | 'partial' | 'error'
  errorMessage?: string
  llmProvider?: string
}

// Module-scoped so every entry point (toolbar menu, column header menu) sees the
// same running state — a run started from one surface shows as running in the others.
const runningColumns = ref<Set<string>>(new Set())

/**
 * Shared bulk-run flow for AI Field Agents: dispatches the backend job, keeps a
 * keyed progress toast alive while it runs, and opens the summary dialog on
 * completion or failure. Used by the toolbar Field Agent menu and the column
 * header menu so both entry points behave identically.
 */
export function useFieldAgentBulkRun() {
  const { $poller, $e } = useNuxtApp()

  const { t } = useI18n()

  const reloadDataHook = inject(ReloadViewDataHookInj, undefined)

  const { aiIntegrations, clearFieldAgentDirty, dispatchFieldAgentJob } = useNocoAi()

  const { showUpgradeToUseFieldAgent } = useEeConfig()

  const isColumnRunning = (colId?: string | null) => (colId ? runningColumns.value.has(colId) : false)

  function progressToastKey(colId: string) {
    return `nc-field-agent-progress-${colId}`
  }

  function showProgressToast(colId: string, title: string, processed?: number, total?: number) {
    const content =
      processed === undefined
        ? t('msg.info.aiAgentStarted', { title })
        : total
        ? t('msg.info.aiAgentProgress', { title, processed, total })
        : t('msg.info.aiAgentProgressIndeterminate', { title, processed })

    // Same key = the existing toast is updated in place; long duration because
    // it is dismissed explicitly when the job finishes.
    message.toast({ key: progressToastKey(colId), content }, 9999)
  }

  function openSummaryModal(stats: FieldAgentBulkStats) {
    const isOpen = ref(true)

    const { close } = useDialog(resolveComponent('DlgFieldAgentSummary') as any, {
      'visible': isOpen,
      'stats': stats,
      'onUpdate:visible': (val: boolean) => {
        if (!val) {
          isOpen.value = false
          close(300)
        }
      },
    })
  }

  async function runFieldAgentBulk({
    modelId,
    viewId,
    column,
    mode,
    source,
  }: {
    modelId: string
    viewId?: string
    column: ColumnType
    mode: FieldAgentRunMode
    source: string
  }) {
    if (!column.id || !column.title) return
    if (showUpgradeToUseFieldAgent()) return
    if (isColumnRunning(column.id)) return

    // Literal event names per mode so the telemetry catalog scanner can find them
    if (mode === 'all') {
      $e('c:field-agent:bulk-run:all', { source })
    } else if (mode === 'unmodified') {
      $e('c:field-agent:bulk-run:unmodified', { source })
    } else {
      $e('c:field-agent:bulk-run:modified', { source })
    }

    const colId = column.id
    const colTitle = column.title

    runningColumns.value.add(colId)

    const startTime = Date.now()

    const finishRun = (stats: FieldAgentBulkStats) => {
      runningColumns.value.delete(colId)
      message.destroy(progressToastKey(colId))
      openSummaryModal(stats)
    }

    try {
      // Dispatch backend job — the backend handles row fetching and batching
      const jobData = await dispatchFieldAgentJob(modelId, {
        columnId: colId,
        mode,
        viewId,
      })

      if (!jobData?.id) {
        runningColumns.value.delete(colId)
        return
      }

      showProgressToast(colId, colTitle)

      $poller.subscribe(
        { id: jobData.id },
        async (data: {
          id: string
          status?: string
          data?: {
            error?: { message: string }
            message?: string
            result?: any
          }
        }) => {
          if (data.status === 'close') return

          if (data.status === JobStatus.COMPLETED) {
            const result = data.data?.result || {}
            const processed = result.processed ?? 0
            const failed = result.failed ?? 0
            const total = result.total ?? 0

            clearFieldAgentDirty(colId)
            reloadDataHook?.trigger()

            finishRun({
              columnName: colTitle,
              mode,
              rowsRequested: total,
              rowsProcessed: processed,
              rowsFailed: failed,
              durationMs: Date.now() - startTime,
              status: failed > 0 ? (processed > 0 ? 'partial' : 'error') : 'success',
              llmProvider: aiIntegrations.value?.[0]?.title,
            })
          } else if (data.status === JobStatus.FAILED) {
            finishRun({
              columnName: colTitle,
              mode,
              rowsRequested: 0,
              rowsProcessed: 0,
              rowsFailed: 0,
              durationMs: Date.now() - startTime,
              status: 'error',
              errorMessage: data.data?.error?.message || t('msg.error.fieldAgentJobFailed'),
              llmProvider: aiIntegrations.value?.[0]?.title,
            })
          } else if (data.data?.message) {
            // Progress updates — the job sends JSON log messages
            try {
              const progress = JSON.parse(data.data.message)
              if (progress.status === 'progress') {
                showProgressToast(colId, colTitle, progress.processed ?? 0, progress.total ?? 0)
              }
            } catch {
              // Non-JSON log message, ignore
            }
          }
        },
      )
    } catch (e: any) {
      finishRun({
        columnName: colTitle,
        mode,
        rowsRequested: 0,
        rowsProcessed: 0,
        rowsFailed: 0,
        durationMs: Date.now() - startTime,
        status: 'error',
        errorMessage: await extractSdkResponseErrorMsg(e),
        llmProvider: aiIntegrations.value?.[0]?.title,
      })
    }
  }

  return {
    runningColumns,
    isColumnRunning,
    runFieldAgentBulk,
  }
}
