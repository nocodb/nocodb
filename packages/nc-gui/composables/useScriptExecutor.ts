export const useScriptExecutor = createSharedComposable(() => {
  const libCode = ref('')
  const isRunning = ref(false)
  const isFinished = ref(false)

  const activeExecutions = ref<Map<string, unknown>>(new Map())

  const fieldIDRowMapping = computed(() => new Map<string, string>())

  const runScript = async (..._args: any) => {}

  const stopExecution = (_args?: string) => {}

  const eventBus = useEventBus<SmartsheetScriptActions>(EventBusEnum.SmartsheetScript)

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
