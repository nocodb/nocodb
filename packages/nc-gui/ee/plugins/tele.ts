import { useDebounceFn } from '@vueuse/core'
import { defineNuxtPlugin, useRouter } from '#imports'
import type { NuxtApp } from '#app'

// todo: generate client id and keep it in cookie(share across sub-domains)
let clientId: string | null = window.localStorage.getItem('nc_id')

// todo: move to a separate library to reuse in other packages
const iframe = document.createElement('iframe')
iframe.style.display = 'none'
iframe.style.height = '1px'
iframe.style.width = '1px'

iframe.setAttribute('src', 'https://nocodb.com/client.html')

window.onmessage = function (e) {
  if (e.origin === 'https://nocodb.com' || e.origin === 'https://www.nocodb.com') {
    if (e.data) {
      clientId = e.data
      window.localStorage.setItem('nc_id', e.data)
      document.body.removeChild(iframe)
    }
  }
}

iframe.onloadeddata = function () {
  iframe.contentWindow?.postMessage('client_id', 'https://nocodb.com')
}

iframe.onload = function () {
  iframe.contentWindow?.postMessage('client_id', 'https://nocodb.com')
}

document.body.appendChild(iframe)

// Usage example:
const debounceTime = 3000 // Debounce time: 1000ms
const maxWaitTime = 10000 // Max wait time: 10000ms

class EventBatcher {
  private queue: any[] = []
  // private batchSize: number

  private nuxtApp: NuxtApp

  constructor(nuxtApp: NuxtApp) {
    // this.batchSize = batchSize
    this.nuxtApp = nuxtApp
  }

  enqueueEvent(event: any) {
    this.queue.push({
      created_at: Date.now(),
      ...event,
    })

    // Check if the queue size reaches the batch size
    // if (this.queue.length >= this.batchSize) {
    this.processQueue()
    // }
  }

  private processQueue = useDebounceFn(
    () => {
      const eventsToProcess = this.queue.splice(0, this.queue.length)
      this.batchProcessor?.(eventsToProcess)
    },
    debounceTime,
    { maxWait: maxWaitTime },
  )

  private batchProcessor = async (events: any[]) => {
    if (!this.nuxtApp.$state.signedIn.value) return
    await this.nuxtApp.$api.instance.post('/api/v1/tele', {
      events,
      clientId,
    })
  }
}

// todo: ignore init if tele disabled
export default defineNuxtPlugin(async (nuxtApp) => {
  const eventBatcher = new EventBatcher(nuxtApp)

  const router = useRouter()

  const route = router.currentRoute
  const tele = {
    emit(evt: string, data: Record<string, any>) {
      eventBatcher.enqueueEvent({
        event: evt,
        ...(data || {}),
        $current_url: sanitisePath(route.value?.matched?.[route.value?.matched?.length - 1]?.path),
        project_id: route.value?.params?.projectId,
        workspace_id: route.value?.params?.typeOrId ?? undefined,
        table_id: route.value?.params?.viewId ?? undefined,
        view_id: route.value?.params?.viewTitle ?? undefined,
      })
    },
  }

  /*
  // skip page event tracking for now
  router.afterEach((to, from) => {
    if (to.path === from.path && (to.query && to.query.type) === (from.query && from.query.type)) return

    const path = to.matched[to.matched.length - 1].path + (to.query && to.query.type ? `?type=${to.query.type}` : '')
    tele.emit('$pageview', {
      $current_url: path,
      project_id: route.value?.params?.projectId,
      workspace_id: route.value?.params?.typeOrId ?? undefined,
      table_id: route.value?.params?.viewId ?? undefined,
      view_id: route.value?.params?.viewTitle ?? undefined,
    })
  }) */

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

  nuxtApp.provide('tele', tele)
  nuxtApp.provide('e', (e: string, data?: Record<string, any>) => tele.emit(e, { data }))
})

// remove () or ? from path
function sanitisePath(path?: string) {
  return path?.toString?.().replace(/(?:\?|\(\))(?=\/|$)/g, '')
}
