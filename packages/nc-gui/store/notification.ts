import { defineStore } from 'pinia'
import type { NotificationType } from 'nocodb-sdk'
import { useApi } from '#imports'

export const useNotification = defineStore('notificationStore', () => {
  const notifications = ref<NotificationType[]>([])

  const pageInfo = ref()

  const isRead = ref(false)

  const { api, isLoading } = useApi()

  const loadNotifications = async () => {
    // todo: pagination
    const response = await api.notification.list({
      is_read: isRead.value,
    })

    notifications.value = response.list
    pageInfo.value = response.pageInfo
  }

  return { notifications, loadNotifications, isLoading, isRead, pageInfo }
})
