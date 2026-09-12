export function useAiRecordContext() {
  const isAiRecordContextEnabled = computed(() => false)

  const isAiChatPanelOpen = computed(() => false)

  const setAiRecordContext = (
    _rec: { tableId: string; recordId: string; title?: string },
    _opts: { openPanel?: boolean } = {},
  ) => {}

  return { isAiRecordContextEnabled, isAiChatPanelOpen, setAiRecordContext }
}
