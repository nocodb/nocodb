export const useCommand = createSharedComposable(() => {
  // Command palette states
  const cmdK = ref(false)
  const cmdL = ref(false)

  // Command palette refs
  const commandPalette = ref()

  /**
   * Set the active command view
   */
  const setActiveCmdView = (cmd: CommandPaletteType) => {
    if (cmd === 'cmd-k') {
      cmdK.value = true
      cmdL.value = false
    } else if (cmd === 'cmd-l') {
      cmdL.value = true
      cmdK.value = false
    } else if (cmd === 'cmd-j') {
      cmdK.value = false
      cmdL.value = false
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'J',
          ctrlKey: isMac() ? undefined : true,
          metaKey: isMac() ? true : undefined,
          bubbles: true,
        }),
      )
    } else {
      cmdL.value = false
      cmdK.value = false
    }
  }

  /**
   * Open command palette (Cmd+K)
   */
  const openCommandPalette = () => {
    commandPalette.value?.open?.()
  }

  /**
   * Close command palette
   */
  const closeCommandPalette = () => {
    commandPalette.value?.close?.()
  }

  return {
    // State
    cmdK,
    cmdL,
    commandPalette,

    // Methods
    setActiveCmdView,
    openCommandPalette,
    closeCommandPalette,
  }
})
