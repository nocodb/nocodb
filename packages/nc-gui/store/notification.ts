import { defineStore } from 'pinia'
import type { NotificationType } from 'nocodb-sdk'

export const useNotification = defineStore('notificationStore', () => {
  const notifications = ref<NotificationType[]>([])
  const isOpened = ref(false)

  const pageInfo = ref()
  const unreadCount = ref(0)

  const notificationTab = ref<'read' | 'unread'>('read')

  const isRead = ref(false)

  const { api, isLoading } = useApi()

  const loadNotifications = async (loadMore = false) => {
    const response = await api.notification.list({
      is_read: isRead.value,
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

  const markAsOpened = async () => {
    isOpened.value = true
  }

  watch(notificationTab, async () => {
    await loadNotifications()
  })

  return {
    notifications,
    loadNotifications,
    isLoading,
    notificationTab,
    isRead,
    pageInfo,
    markAsRead,
    markAllAsRead,
    unreadCount,
    isOpened,
    markAsOpened,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNotification as any, import.meta.hot))
}
