import type { ScriptType } from 'nocodb-sdk'
import { createWorkerCode, generateIntegrationsCode } from '~/components/smartsheet/automation/scripts/utils/workerHelper'
import { generateLibCode } from '~/components/smartsheet/automation/scripts/utils/editorUtils'
import { replaceConfigValues } from '~/components/smartsheet/automation/scripts/utils/configParser'
import type { CallApiAction, ScriptPlaygroundItem, ViewActionPayload } from '~/lib/types'
import { ScriptActionType } from '~/lib/enum'

export const useScriptExecutor = createSharedComposable(() => {
  const { internalApi, api } = useApi()

  const automationStore = useAutomationStore()

  const { loadAutomation } = automationStore

  const { activeProjectId } = storeToRefs(useBases())

  const { activeWorkspace } = storeToRefs(useWorkspace())

  const { activeViewTitleOrId } = storeToRefs(useViewsStore())

  const { activeTableId } = storeToRefs(useTablesStore())

  const { activeAutomationId } = storeToRefs(automationStore)

  const { aiIntegrations } = useNocoAi()

  const isPublic = inject(IsPublicInj, ref(false))

  const { transform } = useEsbuild()

  const eventBus = useEventBus<SmartsheetScriptActions>(Symbol('SmartSheetActions'))

  const libCode = ref<string>('')
  const customCode = ref<string>('')
  const isRunning = ref(false)
  const isFinished = ref(false)

  const activeExecutions = ref<
    Map<
      string,
      {
        status: 'running' | 'finished' | 'error'
        result: any
        error: unknown
        worker: Worker | null
        pk?: string
        fieldId?: string
        playground: Array<ScriptPlaygroundItem>
      }
    >
  >(new Map())

  const fieldIDRowMapping = computed(() => {
    const _fieldIDRowMapping = new Map<string, string>()
    activeExecutions.value.forEach((execution) => {
      if (execution.pk && execution.fieldId) {
        _fieldIDRowMapping.set(`${execution.pk}:${execution.fieldId}`, execution.status)
      }
    })
    return _fieldIDRowMapping
  })

  const actions = {
    log: (scriptId: string, ...args: any[]) => {
      const execution = activeExecutions.value.get(scriptId)
      if (execution) {
        execution.playground.push({ type: 'text', content: args.join(' '), style: 'log' })
      }
    },
    error: (scriptId: string, ...args: any[]) => {
      const execution = activeExecutions.value.get(scriptId)
      if (execution) {
        execution.playground.push({ type: 'text', content: args.join(' '), style: 'error' })
      }
    },
    warn: (scriptId: string, ...args: any[]) => {
      const execution = activeExecutions.value.get(scriptId)
      if (execution) {
        execution.playground.push({ type: 'text', content: args.join(' '), style: 'warning' })
      }
    },
    output: {
      text: (scriptId: string, message: string, type: 'log' | 'error' | 'warning' = 'log') => {
        const execution = activeExecutions.value.get(scriptId)
        if (execution) {
          execution.playground.push({ type: 'text', content: message, style: type })
        }
      },
      markdown: (scriptId: string, content: string) => {
        const execution = activeExecutions.value.get(scriptId)
        if (execution) {
          execution.playground.push({ type: 'markdown', content })
        }
      },
      table: (scriptId: string, data: any[] | object) => {
        const execution = activeExecutions.value.get(scriptId)
        if (execution) {
          execution.playground.push({ type: 'table', content: data })
        }
      },
      clear: (scriptId: string) => {
        const execution = activeExecutions.value.get(scriptId)
        if (execution) {
          execution.playground = []
        }
      },
      inspect: (scriptId: string, data: any) => {
        const execution = activeExecutions.value.get(scriptId)
        if (execution) {
          execution.playground.push({ type: 'inspect', content: data })
        }
      },
    },
  }

  async function handleApiCall(worker: Worker, message: CallApiAction) {
    const { id, method, args } = message.payload
    try {
      const api = internalApi as any
      if (!api[method]) {
        throw new Error(`API method not found: ${method}`)
      }
      const response = await api[method](...args)

      worker.postMessage({
        type: ScriptActionType.RESPONSE,
        payload: { id, payload: response },
      })
    } catch (error: any) {
      console.error(`Error in API call [${method}]:`, error)

      // Create structured error response
      const errorResponse = {
        error: {
          message: error.message || 'Unknown API error',
          name: error.name || 'Error',
          method,
          args: args?.length || 0,
          ...(error.status && { status: error.status }),
          ...(error.statusText && { statusText: error.statusText }),
          ...(error.code && { code: error.code }),
          ...(error.response && {
            responseStatus: error.response.status,
            responseData: error.response.data,
          }),
        },
      }

      worker.postMessage({
        type: ScriptActionType.RESPONSE,
        payload: { id, payload: errorResponse },
      })
    }
  }

  function handleWorkerMessage(scriptId: string, message: any, worker: Worker, onWorkerDone: () => void) {
    switch (message.type) {
      case ScriptActionType.LOG:
      case ScriptActionType.ERROR:
      case ScriptActionType.WARN:
        actions[message.type](scriptId, ...message.payload.args)
        break
      case ScriptActionType.OUTPUT: {
        const { action, args } = JSON.parse(message.payload.message)
        if (action in actions.output) {
          ;(actions.output as any)[action](scriptId, ...args)
        }
        break
      }
      case ScriptActionType.CALL_API:
        handleApiCall(worker, message)
        break
      case ScriptActionType.INPUT: {
        const execution = activeExecutions.value.get(scriptId)
        if (execution) {
          execution.playground.push({
            type: 'input-request',
            content: message.payload,
            id: message.payload.id,
            resolve: (
              value:
                | string
                | Record<string, any>
                | {
                    file: File
                    parsedContents: any
                  },
            ) => {
              if (typeof value === 'object') {
                value = JSON.stringify(value)
              }
              worker.postMessage({ type: ScriptActionType.INPUT_RESOLVED, payload: { id: message.payload.id, value } })
            },
          })
        }
        break
      }

      case ScriptActionType.ACTION: {
        const payload = message.payload as ViewActionPayload

        switch (payload.action) {
          case 'reloadView':
            eventBus.emit(SmartsheetScriptActions.RELOAD_VIEW)
            break
          case 'reloadRow':
            if (payload.rowId) {
              eventBus.emit(SmartsheetScriptActions.RELOAD_ROW, { rowId: payload.rowId })
            }
            break
          default:
            console.warn(`Unknown action: ${payload.action}`)
        }

        // Confirm action completion
        worker.postMessage({
          type: ScriptActionType.ACTION_COMPLETE,
          payload: {
            id: payload.id,
            value: undefined,
          },
        })
        break
      }

      case ScriptActionType.UPDATE_PROGRESS: {
        eventBus.emit(SmartsheetScriptActions.UPDATE_PROGRESS, message.payload)
        break
      }
      case ScriptActionType.RESET_PROGRESS: {
        eventBus.emit(SmartsheetScriptActions.RESET_PROGRESS, message.payload)
        break
      }
      case ScriptActionType.REMOTE_FETCH: {
        api.workspace
          .remoteFetch(activeWorkspace.value?.id, {
            method: message.payload?.options?.method || 'GET',
            headers: message.payload?.options?.headers || {},
            body: message.payload?.options?.body || null,
            url: message.payload.url,
          })
          .then((response: any) => {
            const isError = response.error || (response.status >= 400 && response.status < 600)

            worker.postMessage({
              type: ScriptActionType.REMOTE_FETCH,
              payload: {
                id: message.payload.id,
                value: response,
                error: isError,
              },
            })
          })
          .catch((e: any) => {
            const errorResponse = {
              data: null,
              status: 0,
              statusText: 'Network Error',
              headers: {},
              config: {
                url: message.payload.url,
                method: message.payload?.options?.method || 'GET',
                headers: message.payload?.options?.headers || {},
                data: message.payload?.options?.body || null,
              },
              error: {
                message: e.message || 'Unknown error',
                code: e.code,
                name: e.name || 'Error',
                stack: e.stack,
              },
            }

            worker.postMessage({
              type: ScriptActionType.REMOTE_FETCH,
              payload: {
                id: message.payload.id,
                value: errorResponse,
                error: true,
              },
            })
          })
        break
      }
      case ScriptActionType.DONE:
        onWorkerDone()
        break
      default:
        console.warn(`Unknown message type: ${(message as any).type}`)
    }
  }

  const scriptQueue = new Queue({
    maxConcurrent: 10,
    autoStart: true,
    priorityLevels: 3,
    timeout: 60000,
    rateLimit: {
      enabled: true,
      maxRequestsPerWindow: 20,
      windowSizeMs: 10000,
    },
  })

  const runScript = async (
    script: ScriptType | string,
    row?: Record<string, any>,
    extra?: {
      pk: string
      fieldId: string
      priority?: number
    },
  ) => {
    try {
      if (typeof script === 'string') {
        script = (await loadAutomation(script)) as ScriptType
      }

      const code = replaceConfigValues(script.script ?? '', script.config ?? {})
      const scriptId = `${script.id}-${Date.now()}-${generateRandomNumber()}`

      activeExecutions.value.set(scriptId, {
        worker: null,
        status: 'running',
        result: null,
        error: null,
        fieldId: extra?.fieldId,
        pk: extra?.pk,
        playground: [],
      })

      const executeScript = async () => {
        try {
          isFinished.value = false
          isRunning.value = true

          let runCustomCode = customCode.value

          for (const integration of aiIntegrations.value) {
            runCustomCode = runCustomCode.replace(
              new RegExp(`integrations.${integration.type}.${integration.title}`, 'g'),
              `integrations.${integration.type}.${integration.id}`,
            )
          }

          runCustomCode = `${runCustomCode}
    
    const cursor = {
      activeBaseId: '${activeProjectId.value}',
      activeViewId: ${activeViewTitleOrId.value},
      activeTableId: ${activeTableId.value},
    }
    `

          if (row) {
            runCustomCode = `
      ${runCustomCode}
    cursor.row = (${JSON.stringify(row)})
    `
          }

          const workerCode = createWorkerCode(code ?? '', runCustomCode)
          const minCode = await transform(workerCode)

          if (minCode.error || !minCode.code) {
            activeExecutions.value.set(scriptId, {
              ...activeExecutions.value.get(scriptId)!,
              status: 'error',
              playground: [
                ...activeExecutions.value.get(scriptId)!.playground,
                { type: 'text', content: minCode.error, style: 'error' },
              ],
              error: minCode.error,
            })
            isRunning.value = false
            isFinished.value = true
            return
          }

          await new Promise<void>((resolve, reject) => {
            const blob = new Blob([minCode.code], { type: 'application/javascript' })
            const workerUrl = URL.createObjectURL(blob)
            const worker = new Worker(workerUrl, { type: 'module' })

            activeExecutions.value.set(scriptId, {
              ...activeExecutions.value.get(scriptId)!,
              worker,
            })

            worker.postMessage({ type: 'run', scriptId })

            worker.onmessage = (e) => {
              handleWorkerMessage(scriptId, e.data, worker, () => {
                worker.terminate()
                URL.revokeObjectURL(workerUrl)

                const execution = activeExecutions.value.get(scriptId)
                if (execution) {
                  activeExecutions.value.set(scriptId, {
                    ...execution,
                    status: 'finished',
                    worker: null,
                  })
                }

                isRunning.value = false
                isFinished.value = true
                resolve()
              })
            }

            worker.onerror = (error) => {
              worker.terminate()
              URL.revokeObjectURL(workerUrl)

              const execution = activeExecutions.value.get(scriptId)
              if (execution) {
                activeExecutions.value.set(scriptId, {
                  ...execution,
                  status: 'error',
                  error,
                  worker: null,
                })
              }

              isRunning.value = false
              isFinished.value = true
              reject(error)
            }
          })
        } catch (error) {
          console.error('Script execution failed:', error)

          const execution = activeExecutions.value.get(scriptId)
          if (execution) {
            activeExecutions.value.set(scriptId, {
              ...execution,
              status: 'error',
              error,
              worker: null,
            })
          }

          isRunning.value = false
          isFinished.value = true
          throw error
        }
      }

      try {
        scriptQueue.add(executeScript, {
          id: scriptId,
          priority: extra?.priority || 1,
          timeout: 120000, // 2 minutes timeout per script execution
        })
        return scriptId
      } catch (error) {
        console.error('Failed to queue script execution:', error)

        const execution = activeExecutions.value.get(scriptId)
        if (execution) {
          activeExecutions.value.set(scriptId, {
            ...execution,
            status: 'error',
            error,
            worker: null,
          })
        }

        throw error
      }
    } catch (error) {
      console.error('Failed to run script:', error)
      throw error
    }
  }

  const stopExecution = (scriptId?: string) => {
    if (scriptId) {
      const execution = activeExecutions.value.get(scriptId)
      if (execution) {
        execution.worker?.terminate()
        activeExecutions.value.delete(scriptId)
        scriptQueue.remove(scriptId)
      }
    } else {
      // If no scriptId provided, stop all executions
      activeExecutions.value.forEach((execution) => {
        execution.worker?.terminate()
      })
      activeExecutions.value.clear()
      scriptQueue.clear()
    }

    isRunning.value = false
    isFinished.value = true
  }

  const { isFeatureEnabled } = useBetaFeatureToggle()

  onMounted(async () => {
    if (isPublic.value || !isFeatureEnabled(FEATURE_FLAG.NOCODB_SCRIPTS)) return

    await loadAutomation(activeAutomationId.value)
    const integrationsCode = generateIntegrationsCode(aiIntegrations.value)
    libCode.value = generateLibCode(aiIntegrations.value)

    customCode.value = `
    ${integrationsCode}
    ${customCode.value}
  `
  })

  return {
    runScript,
    stopExecution,
    eventBus,
    isRunning,
    isFinished,
    activeExecutions,
    libCode,
    fieldIDRowMapping,
  }
})
