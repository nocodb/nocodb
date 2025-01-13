import { message } from 'ant-design-vue'

export function useIsCopied(timeoutInMs = 3000) {
  let copiedTimeoutId: number

  const isCopied = ref(false)

  async function performCopy(copyCallback: () => void) {
    if (copiedTimeoutId) window.clearTimeout(copiedTimeoutId)
    try {
      await copyCallback()
      isCopied.value = true
      copiedTimeoutId = window.setTimeout(() => {
        isCopied.value = false
        window.clearTimeout(copiedTimeoutId)
      }, timeoutInMs)
    } catch (e: any) {
      if (e?.message) message.error(e.message)
    }
  }

  return { isCopied, performCopy }
}
