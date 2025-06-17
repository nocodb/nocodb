import type { ScriptType } from 'nocodb-sdk'
import { ScriptActionType } from '~/lib/enum'
import { parseScript, validateConfigValues } from '~/components/smartsheet/automation/scripts/utils/configParser'

const [useProvideScriptStore, useScriptStore] = useInjectionState((_script: ScriptType) => {
  const automationStore = useAutomationStore()
  const { updateAutomation } = automationStore
  const { activeAutomation, isSettingsOpen } = storeToRefs(automationStore)
  const { activeProjectId } = storeToRefs(useBases())

  const {
    runScript: executeScript,
    stopExecution: _stopExecution,
    isRunning,
    isFinished,
    activeExecutions,
    libCode,
  } = useScriptExecutor()

  const code = ref<string>()
  const activeExecutionId = ref<string | null>(null)
  const configValue = ref<Record<string, any>>({})

  const config = computed(() => {
    return parseScript(code.value) ?? {}
  })

  const playground = computed(() => {
    if (!activeExecutionId.value) return []

    const execution = activeExecutions.value.get(activeExecutionId.value)
    return execution?.playground ?? []
  })

  const isValidConfig = computed(() => {
    return validateConfigValues(config.value ?? {}, activeAutomation.value?.config ?? {})?.length === 0
  })

  const shouldShowSettings = computed(() => {
    return config.value?.title || config.value?.description || config.value?.items?.length
  })

  const resolveInput = (id: string, value: string | File) => {
    if (!activeExecutionId.value) return

    const execution = activeExecutions.value.get(activeExecutionId.value)
    if (!execution) return

    const index = execution.playground.findIndex((item) => item.id === id && item.type === 'input-request')
    if (index !== -1) {
      const item = execution.playground[index]
      if (item?.resolve) {
        if (typeof value === 'object') {
          value = JSON.stringify(value)
        }

        item?.resolve(value as string | File)
      }

      execution.worker?.postMessage({
        type: ScriptActionType.INPUT_RESOLVED,
        payload: { id, value },
      })
    }
  }

  const runScript = async () => {
    if (isRunning.value || !isValidConfig.value) return

    activeExecutionId.value = await executeScript({
      ...activeAutomation.value,
      script: code.value,
    })
  }

  const stopScript = () => {
    if (activeExecutionId.value) {
      _stopExecution(activeExecutionId.value)
      activeExecutionId.value = null
    }
  }

  const updateScript = async ({ script, config }: { script: string; config?: Record<string, any> }) => {
    if (!activeProjectId.value || !activeAutomation.value?.id) return

    await updateAutomation(activeProjectId.value, activeAutomation.value.id, {
      script,
      config,
    })

    if (config) {
      configValue.value = config
    }
  }

  const debouncedSave = useDebounceFn(async () => {
    if (!activeProjectId.value || !activeAutomation.value?.id) return
    await updateScript({
      script: code.value,
    })
  }, 2000)

  watch(code, async (_newValue, oldValue) => {
    if (!oldValue) return
    await debouncedSave()
  })

  onBeforeUnmount(() => {
    stopScript()
  })

  return {
    // State
    code,
    configValue,

    // Computed
    config,
    playground,
    isValidConfig,
    isSettingsOpen,
    shouldShowSettings,

    // Script execution state
    isRunning,
    isFinished,
    libCode,

    // Methods
    runScript,
    stopExecution: stopScript,
    resolveInput,
    updateScript,
  }
})

export { useProvideScriptStore }

export function useScriptStoreOrThrow() {
  const state = useScriptStore()

  if (!state) {
    throw new Error('useScriptStoreOrThrow must be used within a ScriptStoreProvider')
  }

  return state
}
