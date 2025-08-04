import type { ScriptType } from 'nocodb-sdk'
import { ScriptActionType } from '~/lib/enum'
import { validateConfigValues, parseScript } from 'nocodb-sdk'
import type { ScriptInputFileUploadResult } from '~/lib/types'

const [useProvideScriptStore, useScriptStore] = useInjectionState((_script: ScriptType) => {
  const automationStore = useAutomationStore()
  const { updateAutomation } = automationStore
  const { activeAutomation, isSettingsOpen } = storeToRefs(automationStore)
  const { activeProjectId } = storeToRefs(useBases())
  const { isUIAllowed } = useRoles()
  const { showUpgradeToUseScripts } = useEeConfig()

  const {
    runScript: executeScript,
    stopExecution: _stopExecution,
    isRunning,
    isFinished,
    activeExecutions,
    libCode,
    activeSteps,
  } = useScriptExecutor()

  const activeExecutionId = ref<string | null>(null)
  const configValue = ref<Record<string, any>>({})

  const config = computed(() => {
    return parseScript(activeAutomation.value?.script) ?? {}
  })

  const isCreateEditScriptAllowed = computed(() => {
    return isUIAllowed('scriptCreateOrEdit')
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

  const resolveInput = (id: string, value: string | Record<string, any> | ScriptInputFileUploadResult) => {
    if (!activeExecutionId.value) return

    const execution = activeExecutions.value.get(activeExecutionId.value)
    if (!execution) return

    const findInputItem = (
      items: ScriptPlaygroundItem[],
    ): { item: ScriptInputRequestPlaygroundItem; index: number; parent?: WorkflowStepItem } | null => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        if (item?.id === id && item.type === 'input-request') {
          return { item: item as ScriptInputRequestPlaygroundItem, index: i }
        }

        // If it's a workflow step, search in its children
        if (item.type === 'workflow-step') {
          const stepItem = item as WorkflowStepItem
          for (let j = 0; j < stepItem.content.children.length; j++) {
            const child = stepItem.content.children[j]
            if (child?.id === id && child.type === 'input-request') {
              return {
                item: child as ScriptInputRequestPlaygroundItem,
                index: j,
                parent: stepItem,
              }
            }
          }
        }
      }
      return null
    }

    const result = findInputItem(execution.playground)

    if (result) {
      const { item } = result

      if (item?.resolve) {
        if (typeof value === 'object') {
          value = JSON.stringify(value)
        }
        item.resolve(value)
      }

      execution.worker?.postMessage({
        type: ScriptActionType.INPUT_RESOLVED,
        payload: { id, value },
      })
    }
  }

  const runScript = async () => {
    if (isRunning.value || !isValidConfig.value || showUpgradeToUseScripts()) return

    isSettingsOpen.value = false

    activeExecutionId.value = await executeScript({
      ...activeAutomation.value,
      script: activeAutomation.value.script,
    })
  }

  const stopScript = () => {
    if (activeExecutionId.value) {
      _stopExecution(activeExecutionId.value)
      activeExecutionId.value = null
    }
  }

  const restartScript = async () => {
    stopScript()
    await runScript()
  }

  const updateScript = async ({
    script,
    config,
    skipNetworkCall,
  }: {
    script?: string
    config?: Record<string, any>
    skipNetworkCall?: boolean
  }) => {
    if (!activeProjectId.value || !activeAutomation.value?.id) return

    if (isCreateEditScriptAllowed.value) {
      await updateAutomation(
        activeProjectId.value,
        activeAutomation.value.id,
        {
          script,
          config,
        },
        {
          skipNetworkCall,
        },
      )
    }

    if (config) {
      configValue.value = config
    }
  }

  const debouncedSave = useDebounceFn(async () => {
    if (!activeProjectId.value || !activeAutomation.value?.id) return
    await updateScript({
      script: activeAutomation.value.script,
    })
  }, 500)

  onBeforeUnmount(() => {
    stopScript()
  })

  return {
    // State
    configValue,

    // Computed
    config,
    playground,
    isValidConfig,
    isSettingsOpen,
    shouldShowSettings,
    isCreateEditScriptAllowed,
    activeSteps,

    // Script execution state
    isRunning,
    isFinished,
    libCode,

    // Methods
    runScript,
    stopExecution: stopScript,
    resolveInput,
    updateScript,
    restartScript,
    debouncedSave,
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
