import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'
import { defineNuxtPlugin, isEeUI, useRouter } from '#imports'

// todo: ignore init if tele disabled
export default defineNuxtPlugin(async (nuxtApp) => {
  if (!isEeUI) {
    const router = useRouter()

    const route = router.currentRoute

    const { appInfo } = useGlobal()

    let socket: Socket

    const init = async (token: string) => {
      try {
        if (socket) socket.disconnect()

        const url = new URL(appInfo.value.ncSiteUrl, window.location.href.split(/[?#]/)[0])
        let socketPath = url.pathname
        socketPath += socketPath.endsWith('/') ? 'socket.io' : '/socket.io'

        socket = io(url.href, {
          extraHeaders: { 'xc-auth': token },
          path: socketPath,
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
        pid: route.value?.params?.baseId,
      })
    })

    const tele = {
      emit(evt: string, data: Record<string, any>) {
        if (socket) {
          socket.emit('event', {
            event: evt,
            ...(data || {}),
            path: route.value?.matched?.[0]?.path,
            pid: route.value?.params?.baseId,
          })
        }
      },
    }

    nuxtApp.vueApp.directive('e', {
      created(el, binding, vnode) {
        if (vnode.el) vnode.el.addEventListener('click', getListener(binding))
        else el.addEventListener('click', getListener(binding))
      },
      beforeUnmount(el, binding, vnode) {
        if (vnode.el) vnode.el.removeEventListener('click', getListener(binding))
        else el.removeEventListener('click', getListener(binding))
      },
    })

    function getListener(binding: any) {
      return function () {
        // if (!socket) return

        const event = binding.value && binding.value[0]
        const data = binding.value && binding.value[1]
        const extra = binding.value && binding.value.slice(2)
        tele.emit(event, {
          data,
          extra,
        })
      }
    }

    watch((nuxtApp.$state as ReturnType<typeof useGlobal>).token, (newToken, oldToken) => {
      try {
        if (newToken && newToken !== oldToken) init(newToken)
        else if (!newToken) socket?.disconnect()
      } catch (e) {
        console.error(e)
      }
    })

    nuxtApp.provide('tele', tele)
    nuxtApp.provide('e', (e: string, data?: Record<string, any>) => tele.emit(e, { data }))
  }
})
