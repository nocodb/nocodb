import type { Socket } from 'socket.io-client'
import type { ComputedRef } from 'vue'
import { defineNuxtPlugin, useNuxtApp, useRouter } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  if (!isEeUI) {
    const router = useRouter()
    const route = router.currentRoute
    const { $socket } = useNuxtApp() as { $socket: ComputedRef<Socket | null> }

    const emitPageEvent = (to: any, from: any) => {
      return
      if (!$socket.value?.connected || (to.path === from.path && to.query?.type === from.query?.type)) {
        return
      }

      $socket.value.emit('page', {
        path: to.matched[0].path + (to.query?.type ? `?type=${to.query.type}` : ''),
        pid: route.value?.params?.baseId,
      })
    }

    router.afterEach(emitPageEvent)

    interface Telemetry {
      emit(evt: string, data: Record<string, any>): void
    }

    const tele: Telemetry = {
      emit(evt: string, data: Record<string, any>) {
        return
        if (!$socket.value?.connected) {
          console.warn(`Socket not connected, cannot emit event: ${evt}`)
          return
        }

        try {
          $socket.value.emit('event', {
            event: evt,
            ...(data || {}),
            path: route.value?.matched?.[0]?.path,
            pid: route.value?.params?.baseId,
          })
        } catch (err) {
          console.error(`Failed to emit event ${evt}:`, err)
        }
      },
    }

    nuxtApp.vueApp.directive('e', {
      created(el, binding, vnode) {
        const listener = getListener(binding)
        if (vnode.el) vnode.el.addEventListener('click', listener)
        else el.addEventListener('click', listener)
      },
      beforeUnmount(el, binding, vnode) {
        const listener = getListener(binding)
        if (vnode.el) vnode.el.removeEventListener('click', listener)
        else el.removeEventListener('click', listener)
      },
    })

    function getListener(binding: any) {
      return () => {
        const event = binding.value?.[0]
        const data = binding.value?.[1]
        const extra = binding.value?.slice(2)
        // tele.emit(event, { data, extra })
      }
    }

    nuxtApp.provide('tele', tele)
    nuxtApp.provide('e', (e: string, data?: Record<string, any>) => {})

    onBeforeUnmount(() => {
      router.afterEach(() => {})
    })
  }

  document.body.removeEventListener('click', clickListener, true)
  document.body.addEventListener('click', clickListener, true)

  document.body.removeEventListener('keydown', keydownListener, true)
  document.body.addEventListener('keydown', keydownListener, true)
})

function clickListener(e) {
  if (e.nc_handled) return
  e.nc_handled = true
  let target = e.target
  return

  const { $e } = useNuxtApp()

  while (target && !target.classList.contains('DocSearch-Hit')) {
    target = target.parentElement
  }
  if (target) {
    const searchInput = document.querySelector('.DocSearch-Input')
    const selectedElement = target.querySelector('a')
    const url = new URL(selectedElement.href)

    e.preventDefault()
    e.stopPropagation()
    url.searchParams.append('search', searchInput?.value)
    url.searchParams.append('origin', location.hostname)

    $e('a:cmdj:searchDocs', {
      search: searchInput?.value,
      url: url.toString(),
    })

    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }
}

function keydownListener(e) {
  if (e.nc_handled || e.which !== 13) return
  e.nc_handled = true
  const { $e } = useNuxtApp()
  return

  let target = e.target

  while (target && !target.classList.contains('DocSearch-Input')) {
    target = target.parentElement
  }

  if (target) {
    const selectedElement = document.querySelector('.DocSearch-Hit[aria-selected=true] a')

    if (selectedElement) {
      const url = new URL(selectedElement.href)

      url.searchParams.append('search', target.value)
      url.searchParams.append('origin', location.hostname)
      e.preventDefault()
      e.stopPropagation()

      $e('a:cmdj:searchDocs', {
        search: target?.value,
        url: url.toString(),
      })

      window.open(url.toString(), '_blank', 'noopener,noreferrer')
    }
  }
}
