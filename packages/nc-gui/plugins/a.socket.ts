import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'

export default defineNuxtPlugin(async (nuxtApp) => {
  let socket: Socket | null = null
  let listenerCounter = 0
  const listeners = new Map<string, { event: string; handler: (...args: any[]) => void }>()

  const state = nuxtApp.$state as ReturnType<typeof useGlobal>
  const { appInfo } = useGlobal()

  function reattachListeners() {
    if (!socket) return
    for (const { event, handler } of listeners.values()) {
      socket.on(event, handler)
    }
  }

  function connect(token: string) {
    if (socket) {
      socket.disconnect()
    }

    try {
      const ncSiteUrl = appInfo.value.ncSiteUrl || ''
      const url = new URL(ncSiteUrl || '', window.location.href.split(/[?#]/)[0])
      let socketPath = url.pathname
      socketPath += socketPath.endsWith('/') ? 'socket.io' : '/socket.io'

      socket = io(url.href, {
        extraHeaders: { 'xc-auth': token },
        path: socketPath,
      })

      // Re-attach existing listeners to the new socket
      reattachListeners()

      socket.on('connect_error', () => {
        // Silently handle connection errors - socket.io will auto-retry
      })
    } catch {
      // Ignore init errors
    }
  }

  // Connect if already signed in
  if (state.signedIn.value && state.token.value) {
    connect(state.token.value)
  }

  // Reconnect on token change
  watch(state.token, (newToken, oldToken) => {
    if (newToken && newToken !== oldToken) {
      connect(newToken)
    } else if (!newToken) {
      socket?.disconnect()
      socket = null
    }
  })

  const ncSocket = {
    id: () => socket?.id ?? null,

    onMessage(evt: string, handler: (...args: any[]) => void): string {
      const listenerId = `listener_${++listenerCounter}`
      listeners.set(listenerId, { event: evt, handler })
      socket?.on(evt, handler)
      return listenerId
    },

    offMessage(listenerId: string) {
      const entry = listeners.get(listenerId)
      if (entry) {
        socket?.off(entry.event, entry.handler)
        listeners.delete(listenerId)
      }
    },

    emit(evt: string, data: any) {
      socket?.emit(evt, data)
    },

    on(evt: string, handler: (...args: any[]) => void) {
      socket?.on(evt, handler)
      return () => {
        socket?.off(evt, handler)
      }
    },
  }

  nuxtApp.provide('ncSocket', ncSocket)
})
