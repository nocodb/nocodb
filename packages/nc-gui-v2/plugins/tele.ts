import { defineNuxtPlugin } from 'nuxt/app'
import type { Socket } from 'socket.io-client'
import io from 'socket.io-client'
import type { UseGlobalReturn } from '~/composables/useGlobal/types'

// todo: ignore init if tele disabled
export default defineNuxtPlugin(async (nuxtApp) => {
  const router = useRouter()
  const route = useRoute()

  let socket: Socket

  const init = async (token: string) => {
    try {
      if (socket) socket.disconnect()

      // todo: extract base url
      const url = 'http://localhost:8080' // new URL($axios.defaults.baseURL, window.location.href.split(/[?#]/)[0]).href
      socket = io(url, {
        extraHeaders: { 'xc-auth': token },
      })

      socket.on('connect_error', () => {
        socket.disconnect()
      })
    } catch {}
  }

  if (nuxtApp.$state.signedIn.value) {
    await init(nuxtApp.$state.token.value)
  }

  router.afterEach((to, from) => {
    if (!socket || (to.path === from.path && (to.query && to.query.type) === (from.query && from.query.type))) return

    socket.emit('page', {
      path: to.matched[0].path + (to.query && to.query.type ? `?type=${to.query.type}` : ''),
    })
  })

  /**
   * unreachable code?
      if (socket) {
        socket.emit('page', {
          path: route.matched[0].path + (route.query && route.query.type ? `?type=${route.query.type}` : ''),
        })
      }
   */

  const tele = {
    emit(evt: string, data: Record<string, any>) {
      // debugger
      if (socket) {
        socket.emit('event', {
          event: evt,
          ...(data || {}),
          path: route?.matched?.[0]?.path,
        })
      }
    },
  }

  nuxtApp.vueApp.directive('t', {
    created(el, binding, vnode) {
      if (vnode.el) vnode.el.addEventListener('click', getListener(binding))
      else el.addEventListener('click', getListener(binding))
    },
  })

  function getListener(binding: any) {
    return function () {
      if (!socket) return

      const event = binding.value && binding.value[0]
      const data = binding.value && binding.value[1]
      const extra = binding.value && binding.value.slice(2)
      tele.emit(event, {
        data,
        extra,
      })
    }
  }

  watch((nuxtApp.$state as UseGlobalReturn).token, (newToken, oldToken) => {
    if (newToken && newToken !== oldToken) init(newToken)
    else if (!newToken) socket.disconnect()
  })

  nuxtApp.provide('tele', tele)
  nuxtApp.provide('e', tele.emit)
})
