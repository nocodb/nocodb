import type { ScriptType } from 'nocodb-sdk'
import { ActionType } from '~/components/smartsheet/automation/scripts/types'
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
  const currentScriptId = ref<string | null>(null)
  const configValue = ref<Record<string, any>>({})

  const config = computed(() => {
    return parseScript(code.value) ?? {}
  })

  const playground = computed(() => {
    if (!currentScriptId.value) return []

    const execution = activeExecutions.value.get(currentScriptId.value)
    return execution?.playground ?? []
  })

  const isValidConfig = computed(() => {
    return validateConfigValues(config.value ?? {}, configValue.value ?? {})?.length === 0
  })
  const resolveInput = (id: string, value: string | File) => {
    if (!currentScriptId.value) return

    const execution = activeExecutions.value.get(currentScriptId.value)
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
        type: ActionType.INPUT_RESOLVED,
        payload: { id, value },
      })
    }
  }

  const runScript = async () => {
    if (isRunning.value || !isValidConfig.value) return

    currentScriptId.value = await executeScript({
      ...activeAutomation.value,
      code: code.value,
    })
  }

  const stopScript = () => {
    if (currentScriptId.value) {
      _stopExecution(currentScriptId.value)
      currentScriptId.value = null
    }
  }

  const debouncedSave = useDebounceFn(async () => {
    await updateAutomation(activeProjectId.value, activeAutomation.value.id, {
      script: code.value,
      config: configValue.value,
    })
  }, 2000)

  watch([code, configValue], async (newValue, oldValue) => {
    if (!oldValue[0] || !oldValue[1]) return
    await debouncedSave()
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

    // Script execution state
    isRunning,
    isFinished,
    libCode,

    // Methods
    runScript,
    stopExecution: stopScript,
    resolveInput,
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
