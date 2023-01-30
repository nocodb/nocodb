import { useClipboard } from '#imports'

export const useCopy = () => {
  /** fallback for copy if clipboard api is not supported */
  const copyFallback = (text: string) => {
    const textAreaEl = document.createElement('textarea')
    textAreaEl.innerHTML = text
    document.body.appendChild(textAreaEl)
    textAreaEl.select()
    const result = document.execCommand('copy')
    document.body.removeChild(textAreaEl)
    return result
  }

  const { copy: _copy, isSupported } = useClipboard()

  const copy = async (text: string) => {
    try {
      if (isSupported.value) {
        await _copy(text)
      } else {
        copyFallback(text)
      }
    } catch (e) {
      copyFallback(text)
    }
  }

  return { copy }
}
