import { useClipboard } from '#imports'

export const useCopy = () => {
  /** fallback for copy if clipboard api is not supported */
  const copyFallback = async (text: string, retryCount = 0): Promise<boolean> => {
    try {
      const textAreaEl = document.createElement('textarea')
      textAreaEl.innerHTML = text
      document.body.appendChild(textAreaEl)
      textAreaEl.select()
      const result = document.execCommand('copy')
      document.body.removeChild(textAreaEl)
      if (!result && retryCount < 3) {
        // retry if copy failed
        return new Promise((resolve) => setTimeout(() => resolve(copyFallback(text, retryCount + 1)), 100))
      }

      if (!result) {
        throw new Error('failed')
      }
      return result
    } catch (e) {
      throw new Error('Clipboard copy failed, please copy it from console log')
      console.log(text)
    }
  }

  const { copy: _copy, isSupported } = useClipboard()

  const copy = async (text: string) => {
    try {
      if (isSupported.value) {
        await _copy(text)
        return true
      } else {
        return copyFallback(text)
      }
    } catch (e) {
      return copyFallback(text)
    }
  }

  return { copy }
}
