import { Modal } from 'ant-design-vue'
import { getI18n } from '../plugins/a.i18n'

export const useCopy = (showDialogIfFailed = false) => {
  const { t } = getI18n().global

  /** fallback for copy if clipboard api is not supported */
  const copyFallback = async (text: string, retryCount = 0): Promise<boolean> => {
    try {
      const textAreaEl = document.createElement('textarea')
      textAreaEl.value = text
      document.body.appendChild(textAreaEl)
      textAreaEl.select()
      const result = document.execCommand('copy')
      document.body.removeChild(textAreaEl)
      if (!result && retryCount < 3) {
        // retry if copy failed
        return new Promise((resolve, reject) =>
          setTimeout(
            () =>
              copyFallback(text, retryCount + 1)
                .then(resolve)
                .catch(reject),
            100,
          ),
        )
      }

      if (!result) {
        throw new Error('failed')
      }
      return result
    } catch (e) {
      if (!showDialogIfFailed) throw new Error(t('msg.error.copyToClipboardError'))

      Modal.info({
        title: 'Copy failed, please manually copy it from here',
        content: text,
        class: 'nc-copy-failed-modal',
        width: '550px',
      })
      return false
    }
  }

  const { copy: _copy, isSupported } = useClipboard()

  const copy = async (text: string) => {
    try {
      if (isSupported.value) {
        await _copy(text)
        return true
      }
    } catch {}

    return copyFallback(text)
  }

  /**
   * Write multiple MIME representations to the clipboard in a single ClipboardItem (e.g. `text/plain`
   * + `text/html`). Falls back to a plain-text `copy()` when there is nothing richer than `text/plain`,
   * when the ClipboardItem API is unavailable, or when the rich write fails.
   */
  const copyMimes = async (content: Record<string, string>) => {
    const types = Object.keys(content).filter((type) => content[type] !== undefined && content[type] !== null)

    const hasRichType = types.some((type) => type !== 'text/plain')

    if (hasRichType && typeof ClipboardItem !== 'undefined' && navigator?.clipboard?.write) {
      try {
        const blobs = Object.fromEntries(types.map((type) => [type, new Blob([content[type]], { type })]))
        await navigator.clipboard.write([new ClipboardItem(blobs)])
        return true
      } catch {
        // fall through to plain-text copy
      }
    }

    return copy(content['text/plain'] ?? '')
  }

  return { copy, copyMimes }
}
