export const usePaste = () => {
  const { t } = useI18n()

  const paste = async (): Promise<boolean> => {
    try {
      // Check if the Clipboard API is supported
      if (!navigator.clipboard) throw new Error(t('msg.error.pasteFromClipboardError'))

      // Read text from the clipboard
      const clipboardText = await navigator.clipboard.readText()

      // Create a new paste event
      const pasteEvent = new Event('paste', {
        bubbles: false,
        cancelable: true,
      })

      // Attach clipboard data to the event
      const clipboardData = {
        getData: () => clipboardText || '',
      }
      Object.defineProperty(pasteEvent, 'clipboardData', { value: clipboardData })

      // Dispatch the event on the document
      document.dispatchEvent(pasteEvent)
      return true
    } catch (e) {
      message.error(t('msg.error.pasteFromClipboardError'))

      return false
    }
  }

  return { paste }
}
