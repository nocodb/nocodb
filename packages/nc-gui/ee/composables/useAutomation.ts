import type { ScriptType } from 'nocodb-sdk'
import { ActionType } from '~/components/smartsheet/Automation/Scripts/types'
import { parseScript } from '~/components/smartsheet/Automation/Scripts/utils/configParser'

const [useProvideScriptStore, useScriptStore] = useInjectionState((_script: ScriptType) => {
  const automationStore = useAutomationStore()
  const { activeAutomationId, activeAutomation, isSettingsOpen } = storeToRefs(automationStore)
  const { loadAutomation } = automationStore

  const code = ref<string>(null)
  const currentScriptId = ref<string | null>(null)

  const config = computed(() => {
    return parseScript(code.value)
  })

  const configValue = ref<Record<string, any>>({})

  const {
    runScript: executeScript,
    stopExecution: _stopExecution,
    isRunning,
    isFinished,
    activeExecutions,
    libCode,
  } = useScriptExecutor()

  const playground = computed(() => {
    if (!currentScriptId.value) return []

    const execution = activeExecutions.value.get(currentScriptId.value)

    return execution?.playground ?? []
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
    if (isRunning.value) return

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

  onMounted(async () => {
    await loadAutomation(activeAutomationId.value)
  })

  return {
    resolveInput,
    stopExecution: stopScript,
    isRunning,
    isFinished,
    playground,
    libCode,
    runScript,
    code,
    config,
    configValue,
    isSettingsOpen,
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
