import { defineStore } from 'pinia'
import type { NotificationType } from 'nocodb-sdk'
import { useApi } from '#imports'

export const useNotification = defineStore('notificationStore', () => {
  const notifications = ref<NotificationType[]>([])

  const pageInfo = ref()

  const isRead = ref(false)

  const { api, isLoading } = useApi()

  const loadNotifications = async (loadMore = false) => {
    // todo: pagination
    const response = await api.notification.list({
      is_read: isRead.value,
      limit: 5,
      offset: loadMore ? notifications.value.length : 0,
    })
    if (loadMore) {
      notifications.value = [...notifications.value, ...response.list]
    } else {
      notifications.value = response.list
    }
    pageInfo.value = response.pageInfo
  }

  const markAsRead = async (notification: NotificationType) => {
    if (notification.is_read) return

    await api.notification.update(notification.id!, {
      is_read: true,
    })

    await loadNotifications()
  }

  return { notifications, loadNotifications, isLoading, isRead, pageInfo, markAsRead }
})
