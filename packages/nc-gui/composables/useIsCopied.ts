import { message } from 'ant-design-vue'

export function useIsCopied(timeoutInMs = 3000) {
  let copiedTimeoutId: ReturnType<typeof setTimeout>

  const isCopied = ref(false)

  async function performCopy(copyCallback: () => void) {
    if (copiedTimeoutId) clearTimeout(copiedTimeoutId)
    try {
      await copyCallback()
      isCopied.value = true
      copiedTimeoutId = setTimeout(() => {
        isCopied.value = false
        clearTimeout(copiedTimeoutId)
      }, timeoutInMs)
    } catch (e: any) {
      if (e?.message) message.error(e.message)
    }
  }

  return { isCopied, performCopy }
}
