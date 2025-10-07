import { NcButton } from '#components'

const isDevelopment = process.env.NODE_ENV === 'development'

export const useUpdateChecker = createSharedComposable(() => {
  const currentCommit = ref<string>()
  const newerCommitDetected = ref()
  const consecutiveNewCommitCount = ref(0)
  const isUpdateAvailable = ref(false)
  const CONFIRMATION_THRESHOLD = 3
  let intervalId: null | NodeJS.Timeout = null
  let disabled = false

  const { $api } = useNuxtApp()

  const { appInfo } = useGlobal()

  const baseURL = $api.instance.defaults.baseURL

  const parseResponse = (text: string) => {
    if (!text) return null
    const lines = text.split('\n')
    const commitLine = lines.find((line) => line.startsWith('Commit:'))
    return commitLine ? commitLine.split(':')?.[1]?.trim?.() : null
  }

  const checkForUpdates = async () => {
    if (disabled) return

    if (appInfo.value?.isOnPrem || isDevelopment) {
      if (intervalId) clearInterval(intervalId)
      disabled = true
      return
    }

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

        if (consecutiveNewCommitCount.value >= CONFIRMATION_THRESHOLD) {
          isUpdateAvailable.value = true

          message.info({
            title: 'New update available!',
            action: h(
              NcButton,
              {
                onClick: () => {
                  location.reload()
                },
                size: 'small',
                type: 'primary',
              },
              () => 'Reload',
            ),
          })

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
