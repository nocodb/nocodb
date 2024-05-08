import { Modal } from 'ant-design-vue'

export const useCopy = (showDialogIfFailed = false) => {
  const { t } = useI18n()

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

  return { copy }
}
