import { defineStore } from 'pinia'
import type { NotificationType } from 'nocodb-sdk'

export const useNotification = defineStore('notificationStore', () => {
  const notifications = ref<NotificationType[]>([])
  const pageInfo = ref()
  const unreadCount = ref(0)

  const notificationTab = ref<'read' | 'unread'>('unread')

  const { api, isLoading } = useApi()

  const pollNotifications = async () => {
    try {
      const res = await api.notification.poll()

      if (res.status === 'success') {
        if (notificationTab.value === 'unread') {
          notifications.value = [JSON.parse(res.data), ...notifications.value]
        }
        unreadCount.value = unreadCount.value + 1
      }
      await pollNotifications()
    } catch (e) {
      // If network error, retry after 2 seconds
      setTimeout(pollNotifications, 2000)
    }
  }

  const loadNotifications = async (loadMore = false) => {
    const response = await api.notification.list({
      is_read: notificationTab.value === 'read',
      limit: 10,
      offset: loadMore ? notifications.value.length : 0,
    })

    if (loadMore) {
      notifications.value = [...notifications.value, ...response.list]
    } else {
      notifications.value = response.list
    }

    pageInfo.value = response.pageInfo
    unreadCount.value = (response as any).unreadCount
  }

  const markAsRead = async (notification: NotificationType) => {
    if (notification.is_read) return

    await api.notification.update(notification.id!, {
      is_read: true,
    })

    notification.is_read = true
  }

  const markAllAsRead = async (notification: NotificationType) => {
    if (notification.is_read) return

    await api.notification.markAllAsRead()
    await loadNotifications()
  }

  watch(notificationTab, async () => {
    await loadNotifications()
  })

  const init = async () => {
    await loadNotifications()
    pollNotifications()
  }

  onMounted(init)

  return {
    notifications,
    loadNotifications,
    isLoading,
    notificationTab,
    pageInfo,
    markAsRead,
    markAllAsRead,
    unreadCount,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNotification as any, import.meta.hot))
}
