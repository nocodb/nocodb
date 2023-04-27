import { defineStore } from 'pinia'
import type { NotificationType } from 'nocodb-sdk'
import io from 'socket.io-client'
import { useApi } from '#imports'

export const useNotification = defineStore('notificationStore', () => {
  const notifications = ref<NotificationType[]>([])

  const pageInfo = ref()

  const isRead = ref(false)

  const { api, isLoading } = useApi()

  const { appInfo } = $(useGlobal())

  const url = new URL(appInfo.ncSiteUrl, window.location.href.split(/[?#]/)[0]).href

  const socket = io(`${url}notifications`, {
    // extraHeaders: { 'xc-auth': token },
  })

  socket.emit('message', 'Hello server!')
  socket.on('message', (data) => {
    debugger
    console.log(data) // 'Hello world!'
  })

  // on socket connection error
  socket.on('connect_error', (err) => {
    debugger
    console.log(err.message) // not authorized
  })

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
