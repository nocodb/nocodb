import type { Socket } from 'socket.io-client'
import io from 'socket.io-client'
import { defineNuxtPlugin, useGlobal, watch } from '#imports'

export default defineNuxtPlugin(async (nuxtApp) => {
  const { appInfo } = $(useGlobal())

  let socket: Socket | null = null
  let messageIndex = 0

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

  const send = (name: string, data: any) => {
    if (socket) {
      const _id = messageIndex++
      socket.emit(name, { _id, data })
      return _id
    }
  }

  const jobs = {
    subscribe(
      job: { id: string; name: string } | any,
      subscribedCb?: () => void,
      statusCb?: (status: 'active' | 'completed' | 'failed' | 'refresh', error?: any) => void,
      logCb?: (data: { message: string }) => void,
    ) {
      const logFn = (data: { id: string; name: string; data: { message: string } }) => {
        if (data.id === job.id) {
          if (logCb) logCb(data.data)
        }
      }
      const statusFn = (data: any) => {
        if (data.id === job.id) {
          if (statusCb) statusCb(data.status, data.error)
          if (data.status === 'completed' || data.status === 'failed') {
            socket?.off('status', statusFn)
            socket?.off('log', logFn)
          }
        }
      }

      const _id = send('subscribe', job)

      const subscribeFn = (data: { _id: number; name: string; id: string }) => {
        if (data._id === _id) {
          if (data.id !== job.id || data.name !== job.name) {
            job.id = data.id
            job.name = data.name
          }
          if (subscribedCb) subscribedCb()
          socket?.on('log', logFn)
          socket?.on('status', statusFn)
          socket?.off('subscribed', subscribeFn)
        }
      }
      socket?.on('subscribed', subscribeFn)
    },
    getStatus(name: string, id: string): Promise<string> {
      return new Promise((resolve) => {
        if (socket) {
          const _id = send('status', { name, id })
          const tempFn = (data: any) => {
            if (data._id === _id) {
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

  nuxtApp.provide('jobs', jobs)
})
