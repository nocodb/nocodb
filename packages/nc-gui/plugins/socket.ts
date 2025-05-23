import { type Socket, io } from 'socket.io-client'
import type { ComputedRef } from 'vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { defineNuxtPlugin } from '#app'

// Event types that the realtime system can handle
export enum RealtimeEventType {
  META_INSERT = 'META_INSERT',
  META_UPDATE = 'META_UPDATE',
  META_DELETE = 'META_DELETE',
}

export interface RealtimeEvent {
  type: string
  data: {
    target: string
    payload: any
    eventId?: string
    workspace_id?: string
    base_id?: string
  }
}

export interface SubscriptionInfo {
  workspace_id: string
  base_id: string
  active: boolean
  lastError?: string
  retryCount: number
}

declare module '#app' {
  interface NuxtApp {
    $socket: ComputedRef<Socket | null>
    $realtime: {
      // Listen for realtime events
      on: (callback: (event: RealtimeEvent) => void) => () => void
      // Subscribe to a base's events
      subscribe: (workspace_id: string, base_id: string) => Promise<void>
      // Unsubscribe from a base's events
      unsubscribe: (workspace_id: string, base_id: string) => Promise<void>
      // Get current socket status
      status: ComputedRef<'connected' | 'disconnected' | 'connecting' | 'error'>
      // Get active subscriptions
      subscriptions: ComputedRef<Record<string, SubscriptionInfo>>
    }
  }
}

// Maximum number of reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 5
// Delay between reconnection attempts (in ms) with exponential backoff
const getReconnectDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 30000)

export default defineNuxtPlugin((nuxtApp) => {
  const socket = ref<Socket | null>(null)
  const { appInfo, signedIn, token } = useGlobal()
  const connectionStatus = ref<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected')
  const subscriptions = ref<Record<string, SubscriptionInfo>>({})
  const reconnectAttempts = ref(0)
  const reconnectTimer = ref<ReturnType<typeof setTimeout> | null>(null)

  // Realtime event handling system
  const realtimeEvents = {
    listeners: [] as ((event: RealtimeEvent) => void)[],

    // Register a new event listener and return a function to remove it
    on(callback: (event: RealtimeEvent) => void) {
      this.listeners.push(callback)
      // Return a cleanup function
      return () => {
        this.listeners = this.listeners.filter((listener) => listener !== callback)
      }
    },

    // Trigger an event to all listeners
    trigger(event: RealtimeEvent) {
      this.listeners.forEach((callback) => callback(event))
    },
  }

  // Get a unique channel key for a subscription
  const getChannelKey = (workspace_id: string, base_id: string) => `${workspace_id}:${base_id}`

  // Initialize or reinitialize the socket connection
  const initSocket = async (authToken: string, forceReconnect = false) => {
    try {
      // If we already have a connected socket and don't need to force reconnect, return
      if (socket.value?.connected && !forceReconnect) {
        return
      }

      // Clean up existing socket
      if (socket.value) {
        socket.value.disconnect()
        socket.value = null
      }

      connectionStatus.value = 'connecting'

      // Cancel any pending reconnect timers
      if (reconnectTimer.value) {
        clearTimeout(reconnectTimer.value)
        reconnectTimer.value = null
      }

      // Get the base URL for the WebSocket connection
      const url = new URL(appInfo.value.ncSiteUrl, window.location.href.split(/[?#]/)[0])
      const socketPath = url.pathname.endsWith('/') ? `${url.pathname}socket.io` : `${url.pathname}/socket.io`

      const newSocket = io(url.href, {
        extraHeaders: { 'xc-auth': authToken },
        path: socketPath,
      })

      // Socket connected successfully
      newSocket.on('connect', () => {
        console.log('Realtime connected:', newSocket.id)
        connectionStatus.value = 'connected'
        reconnectAttempts.value = 0

        // Resubscribe to all active channels
        Object.entries(subscriptions.value).forEach(([channelKey, info]) => {
          if (info.active) {
            const { workspace_id, base_id } = info
            subscribeToChannel(workspace_id, base_id).catch((err) => {
              console.error(`Failed to resubscribe to channel ${channelKey}:`, err)
              subscriptions.value[channelKey].lastError = err.message
            })
          }
        })
      })

      // Socket connection error
      newSocket.on('connect_error', (err) => {
        console.error('Realtime connect error:', err.message)
        connectionStatus.value = 'error'

        // Only attempt to reconnect if we're signed in
        if (signedIn.value && token.value) {
          handleReconnect()
        }
      })

      // Socket disconnected
      newSocket.on('disconnect', (reason) => {
        console.log('Realtime disconnected:', reason)
        connectionStatus.value = 'disconnected'

        // Handle different disconnect reasons
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, we need to reconnect manually
          handleReconnect()
        } else if (reason === 'io client disconnect') {
          // Client initiated disconnect, no need to reconnect
        } else {
          // Other reasons (transport close, etc.), the socket will try to reconnect automatically
        }
      })

      // Listen for all events
      newSocket.onAny((eventName: string, data: any) => {
        if (Object.values(RealtimeEventType).includes(eventName as RealtimeEventType)) {
          realtimeEvents.trigger({ type: eventName, data })
        }
      })

      socket.value = newSocket
    } catch (err) {
      console.error('Realtime initialization failed:', err)
      connectionStatus.value = 'error'
      socket.value = null

      if (signedIn.value && token.value) {
        handleReconnect()
      }
    }
  }

  // Handle reconnection logic
  const handleReconnect = () => {
    if (reconnectTimer.value) {
      clearTimeout(reconnectTimer.value)
    }

    if (reconnectAttempts.value < MAX_RECONNECT_ATTEMPTS && signedIn.value && token.value) {
      const delay = getReconnectDelay(reconnectAttempts.value)
      console.log(`Reconnecting to realtime in ${delay}ms (attempt ${reconnectAttempts.value + 1}/${MAX_RECONNECT_ATTEMPTS})`)

      reconnectTimer.value = setTimeout(() => {
        reconnectAttempts.value++
        initSocket(token.value, true)
      }, delay)
    } else if (reconnectAttempts.value >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Maximum reconnection attempts reached. Please refresh the page.')
      connectionStatus.value = 'error'
    }
  }

  // Subscribe to a channel
  const subscribeToChannel = async (workspace_id: string, base_id: string): Promise<void> => {
    console.log(`Attempting to subscribe to channel for workspace: ${workspace_id}, base: ${base_id}`)
    console.log('Socket state:', {
      id: socket.value?.id,
      connected: socket.value?.connected,
      disconnected: socket.value?.disconnected,
      active: socket.value?.active,
    })

    if (!socket.value?.connected) {
      console.error('Cannot subscribe: Socket not connected')
      throw new Error('Socket not connected')
    }

    return new Promise<void>((resolve, reject) => {
      // Prepare subscription data
      const subscriptionData = JSON.stringify({ workspace_id, base_id })
      console.log('Emitting subscribe event with data:', subscriptionData)

      // Set a timeout to detect server response issues
      const timeoutId = setTimeout(() => {
        console.error('Subscription timeout after 5 seconds')
        const channelKey = getChannelKey(workspace_id, base_id)
        subscriptions.value[channelKey] = {
          ...subscriptions.value[channelKey],
          active: false,
          lastError: 'Subscription timeout',
          retryCount: (subscriptions.value[channelKey]?.retryCount || 0) + 1,
        }
        reject(new Error('Subscription timeout after 5 seconds'))
      }, 5000)

      socket.value!.emit('subscribe', subscriptionData, (response: { status: string; channel: string } | undefined) => {
        clearTimeout(timeoutId)
        const channelKey = getChannelKey(workspace_id, base_id)
        console.log('Subscribe response:', response)

        // If no response, assume an error
        if (!response) {
          console.error('No response received from subscribe event')
          subscriptions.value[channelKey] = {
            ...subscriptions.value[channelKey],
            active: false,
            lastError: 'No response from server',
            retryCount: (subscriptions.value[channelKey]?.retryCount || 0) + 1,
          }
          reject(new Error('No response from server'))
          return
        }

        if (response.status === 'subscribed') {
          console.log(`Subscribed to channel: ${response.channel}`)
          subscriptions.value[channelKey] = {
            workspace_id,
            base_id,
            active: true,
            retryCount: 0,
          }
          resolve()
        } else {
          subscriptions.value[channelKey] = {
            ...subscriptions.value[channelKey],
            active: false,
            lastError: 'Subscription failed',
            retryCount: (subscriptions.value[channelKey]?.retryCount || 0) + 1,
          }
          reject(new Error('Subscription failed'))
        }
      })
    })
  }

  // Subscribe to realtime events for a base
  const subscribe = async (workspace_id: string, base_id: string) => {
    const channelKey = getChannelKey(workspace_id, base_id)

    // Initialize the subscription entry if it doesn't exist
    if (!subscriptions.value[channelKey]) {
      subscriptions.value[channelKey] = {
        workspace_id,
        base_id,
        active: false,
        retryCount: 0,
      }
    }

    // If the socket isn't connected, initiate a connection
    if (!socket.value?.connected) {
      if (!token.value) {
        throw new Error('No authentication token available')
      }
      await initSocket(token.value)
    }

    // Attempt to subscribe to the channel
    try {
      return await subscribeToChannel(workspace_id, base_id)
    } catch (err) {
      console.error(`Failed to subscribe to ${channelKey}:`, err)

      // Retry subscription once if it fails
      if (subscriptions.value[channelKey].retryCount <= 1) {
        console.log(`Retrying subscription to ${channelKey}...`)
        return subscribeToChannel(workspace_id, base_id)
      }

      throw err
    }
  }

  // Unsubscribe from realtime events for a base
  const unsubscribe = async (workspace_id: string, base_id: string) => {
    const channelKey = getChannelKey(workspace_id, base_id)

    // If not connected or not subscribed, no need to unsubscribe
    if (!socket.value?.connected || !subscriptions.value[channelKey]?.active) {
      // Update subscription status
      if (subscriptions.value[channelKey]) {
        subscriptions.value[channelKey].active = false
      }
      return
    }

    return new Promise<void>((resolve, reject) => {
      socket.value!.emit(
        'unsubscribe',
        JSON.stringify({ workspace_id, base_id }),
        (response: { status: string; channel: string } | undefined) => {
          // Update subscription status regardless of response
          if (subscriptions.value[channelKey]) {
            subscriptions.value[channelKey].active = false
          }

          // If no response, assume it worked
          if (!response) {
            resolve()
            return
          }

          if (response.status === 'unsubscribed') {
            console.log(`Unsubscribed from channel: ${response.channel}`)
            resolve()
          } else {
            console.warn(`Failed to unsubscribe from channel: ${response.channel}`)
            reject(new Error('Unsubscription failed'))
          }
        },
      )
    })
  }

  // Initialize the socket if signed in
  if (signedIn.value && token.value) {
    initSocket(token.value)
  }

  // Watch for token changes
  watch(
    token,
    (newToken, oldToken) => {
      if (newToken && newToken !== oldToken) {
        initSocket(newToken)
      } else if (!newToken && socket.value) {
        socket.value.disconnect()
        socket.value = null
        connectionStatus.value = 'disconnected'

        // Mark all subscriptions as inactive
        Object.keys(subscriptions.value).forEach((key) => {
          subscriptions.value[key].active = false
        })
      }
    },
    { immediate: false },
  )

  // Clean up on unmount
  onBeforeUnmount(() => {
    if (reconnectTimer.value) {
      clearTimeout(reconnectTimer.value)
      reconnectTimer.value = null
    }

    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
  })

  // Provide socket and realtime API to the app
  nuxtApp.provide(
    'socket',
    computed(() => socket.value),
  )
  nuxtApp.provide('realtime', {
    on: realtimeEvents.on.bind(realtimeEvents),
    subscribe,
    unsubscribe,
    status: computed(() => connectionStatus.value),
    subscriptions: computed(() => subscriptions.value),
  })
})
