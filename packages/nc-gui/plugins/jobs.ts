import type { Socket } from 'socket.io-client'
import io from 'socket.io-client'
import { JobStatus, defineNuxtPlugin, useGlobal, watch } from '#imports'

export default defineNuxtPlugin(async (nuxtApp) => {
  const { appInfo } = useGlobal()

  let socket: Socket | null = null
  let messageIndex = 0

  const init = async (token: string) => {
    try {
      if (socket) socket.disconnect()

      const url = new URL(appInfo.value.ncSiteUrl, window.location.href.split(/[?#]/)[0])
      let socketPath = url.pathname
      socketPath += socketPath.endsWith('/') ? 'socket.io' : '/socket.io'

      socket = io(`${url.href}jobs`, {
        extraHeaders: { 'xc-auth': token },
        path: socketPath,
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

  const send = (evt: string, data: any) => {
    if (socket) {
      const _id = messageIndex++
      socket.emit(evt, { _id, data })
      return _id
    }
  }

  const jobs = {
    subscribe(
      job: { id: string } | any,
      subscribedCb?: () => void,
      statusCb?: (status: JobStatus, data?: any) => void,
      logCb?: (data: { message: string }) => void,
    ) {
      const logFn = (data: { id: string; data: { message: string } }) => {
        if (data.id === job.id) {
          if (logCb) logCb(data.data)
        }
      }
      const statusFn = (data: any) => {
        if (data.id === job.id) {
          if (statusCb) statusCb(data.status, data.data)
          if (data.status === JobStatus.COMPLETED || data.status === JobStatus.FAILED) {
            socket?.off('status', statusFn)
            socket?.off('log', logFn)
          }
        }
      }

      const _id = send('subscribe', job)

      const subscribeFn = (data: { _id: number; id: string }) => {
        if (data._id === _id) {
          if (data.id !== job.id) {
            job.id = data.id
          }
          if (subscribedCb) subscribedCb()
          socket?.on('log', logFn)
          socket?.on('status', statusFn)
          socket?.off('subscribed', subscribeFn)
        }
      }
      socket?.on('subscribed', subscribeFn)
    },
    getStatus(id: string): Promise<string> {
      return new Promise((resolve) => {
        if (socket) {
          const _id = send('status', { id })
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
