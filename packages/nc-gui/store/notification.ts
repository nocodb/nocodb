import { defineStore } from 'pinia'
import type { NotificationType } from 'nocodb-sdk'
import axios, { type CancelTokenSource } from 'axios'
import { CancelToken } from 'axios'
import { useStorage } from '@vueuse/core'

export const useNotification = defineStore('notificationStore', () => {
  const isTokenRefreshInProgress = useStorage(TOKEN_REFRESH_PROGRESS_KEY, false)

  const readNotifications = ref<NotificationType[]>([])

  const unreadNotifications = ref<NotificationType[]>([])

  const readPageInfo = ref()

  const unreadPageInfo = ref()

  const unreadCount = ref(0)

  const notificationTab = ref<'read' | 'unread'>('unread')

  const { api, isLoading } = useApi()

  const { token } = useGlobal()

  let timeOutId: number | null = null

  let cancelTokenSource: CancelTokenSource | null

  const pollNotifications = async () => {
    try {
      if (!token.value) return

      // set up cancel token for polling to cancel when token changes/token is removed
      cancelTokenSource = CancelToken.source()

      const res = await api.notification.poll({
        cancelToken: cancelTokenSource.token,
      })

      if (res.status === 'success') {
        if (notificationTab.value === 'unread') {
          unreadNotifications.value = [JSON.parse(res.data), ...unreadNotifications.value]
        }

        unreadCount.value = unreadCount.value + 1
      }

      timeOutId = setTimeout(pollNotifications, 0)
    } catch (e) {
      // If request is cancelled, do nothing
      if (axios.isCancel(e)) return
      // If network error, retry after 2 seconds
      timeOutId = setTimeout(pollNotifications, 2000)
    }
  }

  const loadReadNotifications = async (loadMore?: boolean) => {
    try {
      const response = await api.notification.list({
        is_read: true,
        limit: 10,
        offset: loadMore ? readNotifications.value.length : 0,
      })

      if (loadMore) {
        readNotifications.value = [...readNotifications.value, ...response.list]
      } else {
        readNotifications.value = response.list
      }

      readPageInfo.value = response.pageInfo

      unreadCount.value = Number(response.unreadCount)
    } catch (e) {
      console.log(e)
    }
  }

  const loadUnReadNotifications = async (loadMore?: boolean) => {
    try {
      const response = await api.notification.list({
        is_read: false,
        limit: 10,
        offset: loadMore ? unreadNotifications.value.length : 0,
      })

      if (loadMore) {
        unreadNotifications.value = [...unreadNotifications.value, ...response.list]
      } else {
        unreadNotifications.value = response.list
      }

      unreadPageInfo.value = response.pageInfo

      unreadCount.value = Number(response.unreadCount)
    } catch (e) {
      console.log(e)
    }
  }

  const insertAndSort = (notification: NotificationType, oldState?: boolean) => {
    if (oldState) {
      readNotifications.value = readNotifications.value.filter((n) => n.id !== notification.id)

      unreadNotifications.value = [notification, ...unreadNotifications.value].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      unreadCount.value = unreadCount.value + 1
    } else {
      readNotifications.value = [notification, ...readNotifications.value].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      unreadNotifications.value = unreadNotifications.value.filter((n) => n.id !== notification.id)

      unreadCount.value = unreadCount.value - 1
    }
  }

  const toggleRead = async (notification: NotificationType, ignoreTrigger?: boolean) => {
    if (ignoreTrigger) return

    const currState = notification.is_read

    try {
      await api.notification.update(notification.id!, {
        is_read: !currState,
      })
      notification.is_read = !currState

      insertAndSort(notification, currState)
    } catch (e) {
      message.error(
        `Failed to update Notification: ${await extractSdkResponseErrorMsgv2(e as Error & { response: { data: string } })}`,
      )
    }
  }

  const markAllAsRead = async (notification: NotificationType) => {
    if (notification.is_read) return

    await api.notification.markAllAsRead()

    await Promise.allSettled([loadReadNotifications(), loadUnReadNotifications()])
  }

  const deleteNotification = async (notification: NotificationType) => {
    try {
      readNotifications.value = readNotifications.value.filter((n) => n.id !== notification.id)

      await api.notification.delete(notification.id!)
    } catch (e) {
      readNotifications.value = [notification, ...readNotifications.value]

      message.error(
        `Failed to delete Notification: ${await extractSdkResponseErrorMsgv2(
          e as Error & {
            response: {
              data: string
            }
          },
        )}`,
      )
    }
  }

  watch(notificationTab, async (tab) => {
    if (tab === 'read') {
      await loadReadNotifications()
    } else {
      await loadUnReadNotifications()
    }
  })

  // function to clear polling and cancel any pending requests
  const clearPolling = () => {
    if (timeOutId) {
      clearTimeout(timeOutId)
      timeOutId = null
    }
    cancelTokenSource?.cancel()
    cancelTokenSource = null
  }

  const init = async () => {
    await Promise.allSettled([loadReadNotifications(), loadUnReadNotifications()])
    // For playwright, polling will cause the test to hang indefinitely
    // as we wait for the networkidle event. So, we disable polling for playwright
    if (!(window as any).isPlaywright) {
      clearPolling()
      pollNotifications().catch((e) => console.log(e))
    }
  }

  // watch for token changes and re-init notifications if token changes
  watch(
    token,
    async (newToken, oldToken) => {
      try {
        if (newToken && newToken !== oldToken) {
          await init()
        }
        // clear polling if there is no refresh token request in progress
        // and access token is removed
        else if (!newToken && !isTokenRefreshInProgress.value) {
          clearPolling()
        }
      } catch (e) {
        console.error(e)
      }
    },
    {
      immediate: true,
    },
  )

  return {
    unreadNotifications,
    readNotifications,
    loadUnReadNotifications,
    loadReadNotifications,
    deleteNotification,
    readPageInfo,
    unreadPageInfo,
    isLoading,
    notificationTab,
    toggleRead,
    markAllAsRead,
    unreadCount,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNotification, import.meta.hot))
}
