import type { Socket } from 'socket.io-client'
import io from 'socket.io-client'
import type { Ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useGlobal } from '#imports'

export const useSocketApi = createSharedComposable(() => {
  const state = useGlobal()

  const requestQuery: Record<string, any> = {}

  const socket: Ref<Socket | undefined> = ref()

  const init = async (token: string) => {
    try {
      if (socket.value) socket.value.disconnect()

      const url = new URL(state.appInfo.value.ncSiteUrl, window.location.href.split(/[?#]/)[0]).href

      socket.value = io(url, {
        extraHeaders: { 'xc-auth': token },
      })

      socket.value.on('connect_error', () => {
        socket.value?.disconnect()
      })

      socket.value.on('api', (data) => {
        if (data.id in requestQuery) {
          const tq = requestQuery[data.id]
          if (data?.setCookie) {
            for (const ck of data.setCookie) {
              // TODO fix event
              setCookie({} as any, ck.name, ck.value, ck.options)
            }
          }
          tq.promise.resolve(data)

          delete requestQuery[data.id]
        } else {
          console.log('Unknown query', data)
        }
      })
    } catch {}
  }

  watch(
    state.token,
    (newToken, oldToken) => {
      if (newToken && newToken !== oldToken) init(newToken)
      else if (!newToken) socket.value?.disconnect()
    },
    { immediate: true },
  )

  return {
    init,
    socket,
    request: (data: any): Promise<any> => {
      return new Promise((resolve, reject) => {
        if (!socket.value) return reject(new Error('Socket not initialized'))
        const tq = {
          id: uuidv4(),
          promise: {
            resolve,
            reject,
          },
          data,
          dt: Date.now(),
        }

        requestQuery[tq.id] = tq

        socket.value?.emit('api', { id: tq.id, ...tq.data })
      })
    },
  }
})
