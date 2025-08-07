import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'

export default defineNuxtPlugin(async (nuxtApp) => {
  const { appInfo } = useGlobal()

  let socket: Socket
  const subscribedChannels: string[] = []
  const messageHandlers: Map<string, (...args: any[]) => void> = new Map()

  const init = async (token: string) => {
    try {
      if (socket) socket.disconnect()

      const url = new URL(appInfo.value.ncSiteUrl, window.location.href.split(/[?#]/)[0])
      let socketPath = url.pathname
      socketPath += socketPath.endsWith('/') ? 'socket.io' : '/socket.io'

      socket = io(url.href, {
        path: socketPath,
        transports: ['websocket'],
      })

      const handshake = (backoff = 0) => {
        socket.emit('handshake', { token }, (response: any) => {
          if (response.status !== 'ok') {
            console.error('Handshake failed')
            if (backoff < 5) {
              setTimeout(() => handshake(backoff + 1), backoff * 1000)
            } else {
              console.error('Max handshake attempts reached, disconnecting socket')
              socket.disconnect()
            }
          } else {
            subscribedChannels.forEach((channel) => {
              socket.emit('event:subscribe', channel)
            })
          }
        })
      }

      socket.on('connect', () => {
        // Emit handshake event to set up user context
        handshake()
      })

      socket.on('connect_error', () => {
        socket.disconnect()
      })
    } catch {}
  }

  const ncSocket = {
    id: () => socket?.id || null,
    subscribe: (event: string) => {
      if (!socket || subscribedChannels.includes(event)) return
      socket.emit('event:subscribe', event)
      subscribedChannels.push(event)
    },
    onMessage: (evt: string, handler: (...args: any[]) => void) => {
      if (!socket) return
      const localHandler = (...args: any[]) => {
        // if socketId is same skip the event
        if (args[0]?.socketId && args[0].socketId === socket.id) return
        handler(...args)
      }
      socket.on(evt, localHandler)
      messageHandlers.set(evt, localHandler)
    },
    offMessage: (evt: string) => {
      const handler = messageHandlers.get(evt)
      if (handler) {
        socket.off(evt, handler)
        messageHandlers.delete(evt)
      }
    },
  }

  if (
    (nuxtApp.$state as ReturnType<typeof useGlobal>).signedIn.value &&
    (nuxtApp.$state as ReturnType<typeof useGlobal>).token.value
  ) {
    await init((nuxtApp.$state as ReturnType<typeof useGlobal>).token.value as string)
  }

  watch((nuxtApp.$state as ReturnType<typeof useGlobal>).token, (newToken, oldToken) => {
    try {
      if (newToken && newToken !== oldToken) init(newToken)
      else if (!newToken) socket?.disconnect()
    } catch (e) {
      console.error(e)
    }
  })

  nuxtApp.provide('ncSocket', ncSocket)
})
