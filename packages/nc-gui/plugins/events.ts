import type { Socket } from 'socket.io-client'
import io from 'socket.io-client'
import { defineNuxtPlugin, useGlobal, watch } from '#imports'

export default defineNuxtPlugin(async (nuxtApp) => {
  const { appInfo } = $(useGlobal())

  let socket: Socket | null = null

  const init = async (token: string) => {
    try {
      if (socket) socket.disconnect()

      const url = new URL(appInfo.ncSiteUrl, window.location.href.split(/[?#]/)[0])

      socket = io(`${url.href}jobs`, {
        extraHeaders: { 'xc-auth': token },
      })

      socket.on('connect_error', (e) => {
        console.error(e)
        socket?.disconnect()
      })
    } catch {}
  }

  if (nuxtApp.$state.signedIn.value) {
    await init(nuxtApp.$state.token.value)
  }

  const events = {
    subscribe(type: string, id: string, cb: (data: any) => void) {
      if (socket) {
        socket.emit('subscribe', { type, id })
        const tempFn = (data: any) => {
          if (data.id === id && data.type === type) {
            cb(data)
            if (data.status === 'completed' || data.status === 'failed') {
              socket?.off('status', tempFn)
            }
          }
        }
        socket.on('status', tempFn)
      }
    },
    getStatus(type: string, id: string): Promise<string> {
      return new Promise((resolve) => {
        if (socket) {
          socket.emit('status', { type, id })
          const tempFn = (data: any) => {
            if (data.id === id && data.type === type) {
              resolve(data.status)
              socket?.off('status', tempFn)
            }
          }
          socket.on('status', tempFn)
        }
      })
    },
  }

  watch((nuxtApp.$state as ReturnType<typeof useGlobal>).token, (newToken, oldToken) => {
    if (newToken && newToken !== oldToken) init(newToken)
    else if (!newToken) socket?.disconnect()
  })

  nuxtApp.provide('events', events)
})
