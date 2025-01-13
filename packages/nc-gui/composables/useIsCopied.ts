export function useIsCopied(timeoutInMs = 3000) {
  let copiedTimeoutId: number

  const isCopied = ref(false)

  async function performCopy(copyCallback: () => void) {
    if (copiedTimeoutId) window.clearTimeout(copiedTimeoutId)

    await copyCallback()
    isCopied.value = true
    copiedTimeoutId = window.setTimeout(() => {
      isCopied.value = false
      window.clearTimeout(copiedTimeoutId)
    }, timeoutInMs)
  }

  return { isCopied, performCopy }
}
