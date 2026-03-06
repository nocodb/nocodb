import { message as antMessage } from 'ant-design-vue/es'
import { NcAlert, NcButton, GeneralIcon } from '#components'
import { getI18n } from '~/plugins/a.i18n'

const isDevelopment = process.env.NODE_ENV === 'development'

export const useUpdateChecker = createSharedComposable(() => {
  const currentCommit = ref<string>()
  const newerCommitDetected = ref()
  const consecutiveNewCommitCount = ref(0)
  const isUpdateAvailable = ref(false)
  const CONFIRMATION_THRESHOLD = 3
  let intervalId: null | NodeJS.Timeout = null
  let disabled = false

  const { t } = getI18n().global

  const { $api, $e } = useNuxtApp()

  const { appInfo } = useGlobal()

  const baseURL = $api.instance.defaults.baseURL

  let updateMessageKey: string | null = null

  const showUpdateNotification = () => {
    if (updateMessageKey) return

    updateMessageKey = `nc-update-${Date.now()}`

    antMessage.open({
      key: updateMessageKey,
      content: () =>
        h(
          NcAlert,
          {
            message: t('general.newUpdateAvailable'),
            type: 'info',
            isNotification: true,
            showIcon: true,
            closable: false,
            showDuration: false,
          },
          {
            action: () =>
              h(
                NcButton,
                {
                  onClick: () => {
                    $e('a:ui:reload-to-update')
                    location.reload()
                  },
                  size: 'small',
                  type: 'primary',
                },
                () => t('general.reload'),
              ),
            icon: () => h(GeneralIcon, { icon: 'ncInfo', class: 'h-5 w-5' }),
          },
        ),
      duration: 0,
      class: 'nc-update-notification-center',
    })
  }

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

          showUpdateNotification()

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
