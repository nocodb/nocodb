import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'

export default defineNuxtPlugin(async (nuxtApp) => {
  const { appInfo } = useGlobal()

  let socket: Socket
  const subscribedChannels: string[] = []
  const messageHandlers: Map<string, { evt: string; handler: (...args: any[]) => void }> = new Map()

  const init = async (token: string) => {
    try {
      if (socket) socket.disconnect()

      const url = new URL(appInfo.value.ncSiteUrl, window.location.href.split(/[?#]/)[0])
      let socketPath = url.pathname
      socketPath += socketPath.endsWith('/') ? 'socket.io' : '/socket.io'

      socket = io(url.href, {
        path: socketPath,
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
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
            // Resubscribe to all channels after successful handshake
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

      socket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts')
        // Handshake will resubscribe to all channels
        handshake()
      })

      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Attempting to reconnect...', attemptNumber)
      })

      socket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error)
      })

      socket.on('reconnect_failed', () => {
        console.error('Failed to reconnect')
      })

      socket.on('connect_error', (error) => {
        console.error('Connection error:', error)
      })

      socket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect') {
          socket.connect()
        }
      })
    } catch (e) {
      console.error('Socket initialization error:', e)
    }
  }

  const ncSocket = {
    /** Returns the current socket connection ID, or null if not connected. */
    id: () => socket?.id || null,
    /**
     * Subscribe to a server-broadcast event channel and register a handler.
     *
     * Sends `event:subscribe` to the server on first call for a given channel
     * (so the server joins the socket to the correct room). Automatically
     * filters out echoes of events the current socket emitted itself.
     * Returns a `listenerId` that must be passed to `offMessage` to unsubscribe.
     *
     * @example
     * const id = $ncSocket.onMessage('event-data:ws1:base1:table1', (payload) => { ... })
     * // later:
     * $ncSocket.offMessage(id)
     */
    onMessage: (evt: string, handler: (...args: any[]) => void) => {
      if (!socket) return

      if (!subscribedChannels.includes(evt)) {
        socket.emit('event:subscribe', evt)
        subscribedChannels.push(evt)
      }

      const listenerId = generateRandomNumber()

      const localHandler = (...args: any[]) => {
        // if socketId is same skip the event
        if (args[0]?.socketId && args[0].socketId === socket.id) return
        handler(...args)
      }
      socket.on(evt, localHandler)
      messageHandlers.set(listenerId, { evt, handler: localHandler })

      return listenerId
    },
    /**
     * Unsubscribe a handler registered with `onMessage`.
     *
     * @example
     * $ncSocket.offMessage(listenerId)
     */
    offMessage: (listenerId: string) => {
      const handler = messageHandlers.get(listenerId)
      if (handler) {
        socket.off(handler.evt, handler.handler)
        messageHandlers.delete(listenerId)
      }
    },
    /**
     * Emit an event directly to the server. No room subscription is performed.
     * Use for client-initiated events such as presence updates.
     * No-ops if the socket is not connected.
     *
     * @example
     * $ncSocket.emit('presence:update', { action: 'heartbeat', user: { id }, resource: { ... } })
     */
    emit: (evt: string, payload: Record<string, any>) => {
      if (!socket?.connected) return
      socket.emit(evt, payload)
    },
    /**
     * Listen to a raw socket.io event (e.g. `'reconnect'`).
     * Unlike `onMessage`, this does NOT subscribe to a server room or filter self-emits.
     * Returns an unsubscribe function.
     *
     * @example
     * const unsub = $ncSocket.on('reconnect', () => { ... })
     * // later:
     * unsub()
     */
    on: (evt: string, handler: (...args: any[]) => void) => {
      socket?.on(evt, handler)
      return () => socket?.off(evt, handler)
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
