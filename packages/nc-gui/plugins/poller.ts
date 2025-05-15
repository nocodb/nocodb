import type { Api as BaseAPI } from 'nocodb-sdk'

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
        for (const r of response) {
          if (r.status === 'close') {
            return cb(r)
          } else {
            if (r.status === 'update') {
              cb(r.data)
            }
            lastMid = r._mid
          }
        }
        await subscribe(topic, cb, lastMid)
      } else {
        if (response.status === 'close') {
          return cb(response)
        } else if (response.status === 'update') {
          cb(response.data)
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
