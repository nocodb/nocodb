import { defineStore } from 'pinia'
import type { NotificationType } from 'nocodb-sdk'
import type { Socket } from 'socket.io-client'
import io from 'socket.io-client'
import { useApi } from '#imports'

export const useNotification = defineStore('notificationStore', () => {
  const notifications = ref<NotificationType[]>([])

  const pageInfo = ref()

  const isRead = ref(false)

  const { api, isLoading } = useApi()

  const { appInfo, token } = $(useGlobal())
  let socket: Socket

  const init = (token) => {
    const url = new URL(appInfo.ncSiteUrl, window.location.href.split(/[?#]/)[0]).href

    socket = io(`${url}${url.endsWith('/') ? '' : '/'}notifications`, {
      extraHeaders: { 'xc-auth': token },
    })

    socket.on('notification', (data) => {
      notifications.value = [data, ...notifications.value]
      pageInfo.value.totalRows += 1
    })
  }

  watch(
    () => token,
    (newToken, oldToken) => {
      if (newToken && newToken !== oldToken) init(newToken)
      else if (!newToken) socket?.disconnect()
    },
  )

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


  const markAllAsRead = async (notification: NotificationType) => {
    if (notification.is_read) return

    await api.notification.markAllAsRead()

    await loadNotifications()
  }



  return { notifications, loadNotifications, isLoading, isRead, pageInfo, markAsRead, markAllAsRead }
})
