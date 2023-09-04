export const useCommandPalette = createSharedComposable(() => {
  const commandPalette = ref()

  const refreshCommandPalette = createEventHook<void>()

  const cmdPlaceholder = ref('Quick actions')

  const cmdData = computed(() => {})

  const activeScope = computed(() => ({} as any))

  return {
    commandPalette,
    cmdData,
    activeScope,
    cmdPlaceholder,
    refreshCommandPalette: refreshCommandPalette.trigger,
  }
})
