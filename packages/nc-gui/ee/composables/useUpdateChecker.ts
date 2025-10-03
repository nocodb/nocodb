export const useUpdateChecker = createSharedComposable(() => {
  const currentCommit = ref<string>()
  const newerCommitDetected = ref()
  const consecutiveNewCommitCount = ref(0)
  const isUpdateAvailable = ref(false)
  const CONFIRMATION_THRESHOLD = 3
  let intervalId: null | NodeJS.Timeout = null
  let toastShown = false

  const { $api } = useNuxtApp()

  const baseURL = $api.instance.defaults.baseURL

  const parseResponse = (text: string) => {
    if (!text) return null
    const lines = text.split('\n')
    const commitLine = lines.find((line) => line.startsWith('Commit:'))
    return commitLine ? commitLine.split(':')?.[1]?.trim?.() : null
  }

  const checkForUpdates = async () => {
    try {
      const text = (await $fetch('/nc.txt', {
        method: 'GET',
        baseURL,
      })) as string
      const newCommit = parseResponse(text)

      if (!newCommit) return

      if (!currentCommit.value) {
        currentCommit.value = newCommit
        return
      }

      if (currentCommit.value !== newCommit) {
        if (newerCommitDetected.value !== newCommit) {
          newerCommitDetected.value = newCommit
          consecutiveNewCommitCount.value = 1
        } else {
          consecutiveNewCommitCount.value++
        }

        if (consecutiveNewCommitCount.value >= CONFIRMATION_THRESHOLD && !toastShown) {
          isUpdateAvailable.value = true

          message.info({
            title: 'New update available! ',
            action: h(
              resolveComponent('NcButton'),
              {
                onClick: () => {
                  location.reload()
                },
                size: 'small',
                type: 'secondary',
              },
              () => 'Reload',
            ),
          })
          toastShown = true
          currentCommit.value = newCommit
        }
      } else if (newerCommitDetected.value !== null) {
        consecutiveNewCommitCount.value = 0
      }
    } catch {}
  }

  onMounted(() => {
    checkForUpdates()
    intervalId = setInterval(checkForUpdates, 60000)
  })

  onUnmounted(() => {
    if (intervalId) {
      clearInterval(intervalId)
    }
  })

  return {
    isUpdateAvailable,
  }
})
