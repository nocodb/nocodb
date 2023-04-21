import { defineStore } from 'pinia'
import type { NotificationType } from 'nocodb-sdk'
import { useApi } from '#imports'

export const useNotification = defineStore('notificationStore', () => {
  const notifications = ref<NotificationType[]>([])

  const pageInfo = ref()

  const { api, isLoading } = useApi()

  const loadNotifications = async (param: { is_read?: boolean }) => {
    // todo: pagination
    const response = await api.notification.list(param)

    notifications.value = response.list
    pageInfo.value = response.pageInfo
  }

  return { notifications, loadNotifications, isLoading }
})
