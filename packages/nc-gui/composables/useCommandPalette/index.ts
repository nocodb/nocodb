export const useCommandPalette = createSharedComposable(() => {
  const commandPalette = ref()

  const refreshCommandPalette = createEventHook<void>()

  const cmdPlaceholder = ref('Quick actions')

  const cmdData = computed(() => {})

  const activeScope = computed(() => {})

  async function loadScope(_scope = 'root', _data?: any) {}

  return {
    commandPalette,
    cmdData,
    activeScope,
    loadScope,
    cmdPlaceholder,
    refreshCommandPalette: refreshCommandPalette.trigger,
  }
})
