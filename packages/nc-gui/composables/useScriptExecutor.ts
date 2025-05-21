export const useScriptExecutor = createSharedComposable(() => {
  const eventBus = useEventBus<SmartsheetScriptActions>(Symbol('SmartSheetActions'))

  const libCode = ref<string>('')
  const isRunning = ref(false)
  const isFinished = ref(false)

  const activeExecutions = ref<Map<string, unknown>>(new Map())

  const fieldIDRowMapping = computed(() => new Map<string, string>())

  const runScript = async (_args, _args_2?, _args_3?) => {}

  const stopExecution = (_args?: string) => {}

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
