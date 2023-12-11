export const usePaste = () => {
  const paste = async (): Promise<boolean> => {
    try {
      // Check if the Clipboard API is supported
      if (!navigator.clipboard) return false

      // Read text from the clipboard
      const clipboardText = await navigator.clipboard.readText()

      // Create a new paste event
      const pasteEvent = new Event('paste')

      // Attach clipboard data to the event
      const clipboardData = {
        getData: () => clipboardText || '',
      }
      Object.defineProperty(pasteEvent, 'clipboardData', { value: clipboardData })

      // Dispatch the event on the document or any other target element
      document.dispatchEvent(pasteEvent)
      return true
    } catch (e) {
      return false
    }
  }

  return { paste }
}
