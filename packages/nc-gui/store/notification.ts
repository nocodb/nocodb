import { defineStore } from 'pinia'
import type { NotificationType } from 'nocodb-sdk'
import type { Socket } from 'socket.io-client'
import io from 'socket.io-client'
import { useApi } from '#imports'

export const useNotification = defineStore('notificationStore', () => {
  const notifications = ref<NotificationType[]>([])
  const isOpened = ref(false)

  const pageInfo = ref()
  const unreadCount = ref(0)

  const isRead = ref(false)

  const { api, isLoading } = useApi()

  const { appInfo, token } = useGlobal()

  let socket: Socket

  const init = (token) => {
    const url = new URL(appInfo.value.ncSiteUrl, window.location.href.split(/[?#]/)[0]).href

    socket = io(`${url}${url.endsWith('/') ? '' : '/'}notifications`, {
      extraHeaders: { 'xc-auth': token },
    })

    socket.on('notification', (data) => {
      notifications.value = [data, ...notifications.value]
      pageInfo.value.totalRows += 1
      unreadCount.value += 1
      isOpened.value = false
    })

    socket.emit('subscribe', {})
  }

  watch(
    () => token.value,
    (newToken, oldToken) => {
      if (newToken && newToken !== oldToken) init(newToken)
      else if (!newToken) socket?.disconnect()
    },
    { immediate: true },
  )

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

  return {
    notifications,
    loadNotifications,
    isLoading,
    isRead,
    pageInfo,
    markAsRead,
    markAllAsRead,
    unreadCount,
    isOpened,
    markAsOpened,
  }
})
