import type { Api as BaseAPI } from 'nocodb-sdk'
import { JobStatus } from '~/lib/enums'

const pollPlugin = async (nuxtApp) => {
  const api: BaseAPI<any> = nuxtApp.$api as any

  // unsubscribe all if signed out
  let unsub = false

  const unsubMap: Map<string, () => void> = new Map()

  const subscribe = async (
    topic: { id: string } | any,
    cb: (data: {
      id: string
      status?: string
      data?: {
        error?: {
          message: string
        }
        message?: string
        result?: any
      }
    }) => void,
    _mid = 0,
  ) => {
    if (unsub) return

    if (unsubMap.has(topic.id)) {
      unsubMap.get(topic.id)!()
      return
    }

    try {
      const response:
        | {
            _mid: number
            id: string
            status: 'refresh' | 'update' | 'close'
            data: any
          }
        | {
            _mid: number
            id: string
            status: 'refresh' | 'update' | 'close'
            data: any
          }[] = await api.jobs.listen({ _mid, data: topic })

      if (Array.isArray(response)) {
        let lastMid = 0
        let terminal = false
        for (const r of response) {
          if (r.status === 'close') {
            return cb(r)
          } else {
            if (r.status === 'update') {
              cb(r.data)

              // Stop on a terminal job status without waiting for `close`.
              // `close` can be lost (server restart, sibling instance, or the
              // backend's closedJobs window elapsing), which would otherwise
              // leave this loop polling forever. The terminal status is the
              // last message in an ordered batch, so the rest of the batch is
              // still delivered before we stop.
              if (r.data?.status && [JobStatus.COMPLETED, JobStatus.FAILED].includes(r.data.status as JobStatus)) {
                terminal = true
              }
            }
            lastMid = r._mid
          }
        }
        if (terminal) return
        await subscribe(topic, cb, lastMid)
      } else {
        if (response.status === 'close') {
          return cb(response)
        } else if (response.status === 'update') {
          cb(response.data)

          if (response.data?.status && [JobStatus.COMPLETED, JobStatus.FAILED].includes(response.data.status as JobStatus)) {
            return
          }

          await subscribe(topic, cb, response._mid)
        } else if (response.status === 'refresh') {
          await subscribe(topic, cb, _mid)
        }
      }
    } catch (e) {
      setTimeout(() => {
        subscribe(topic, cb, _mid)
      }, 1000)
    }
  }

  const unsubscribe = (topic: { id: string }) => {
    return new Promise<void>((resolve) => {
      unsubMap.set(topic.id, resolve)
    })
  }

  const init = () => {
    unsub = false
  }

  if ((nuxtApp.$state as ReturnType<typeof useGlobal>).signedIn.value) {
    await init()
  }

  watch((nuxtApp.$state as ReturnType<typeof useGlobal>).token, (newToken, oldToken) => {
    if (newToken && newToken !== oldToken) init()
    else if (!newToken) {
      unsub = true
    }
  })

  const poller = {
    subscribe,
    unsubscribe,
  }

  nuxtApp.provide('poller', poller)
}

export default defineNuxtPlugin(async function (nuxtApp) {
  if (!isEeUI) return await pollPlugin(nuxtApp)
})

export { pollPlugin }
