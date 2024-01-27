import { useDebounceFn } from '@vueuse/core'
import type { PostHog } from 'posthog-js'
import posthog from 'posthog-js'
import { init } from 'nc-analytics'
import { defineNuxtPlugin, until, useGlobal, useRouter } from '#imports'
import type { NuxtApp } from '#app'

// todo: generate client id and keep it in cookie(share across sub-domains)
let clientId = null
let isTeleEnabled = false
let phClient: PostHog | void

try {
  init({
    clientIdCb: (id) => {
      clientId = id
      initPostHog(id)
    },
  })
} catch (e) {}

function initPostHog(clientId: string) {
  try {
    if (!isTeleEnabled) return
    if (!phClient) {
      phClient = posthog.init('phc_XIYhmt76mLGNt1iByEFoTEbsyuYeZ0o7Q5Ang4G7msr', {
        api_host: 'https://app.posthog.com',
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: ":not([data-rec='true'])",
          maskTextFn: (text: string) => {
            if (!text?.trim()) return text
            if (text.length <= 2) return text.replace(/./g, '*')
            return text.replace(/^(.{3})([\s\S]*)/g, (_, m1, m2) => {
              return m1 + (m2 ? '*'.repeat(m2.length) : '')
            })
          },
        },
        autocapture: false,
        capture_pageview: false,
      })
    }
    posthog.identify(clientId)
  } catch (e) {
    // console.log(e)
    // ignore error
  }
}

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
      try {
        eventBatcher.enqueueEvent({
          event: evt,
          ...(data || {}),
          $current_url: route.value?.path,
          path: sanitisePath(route.value?.matched?.[route.value?.matched?.length - 1]?.path),
          base_id: route.value?.params?.baseId,
          workspace_id: route.value?.params?.typeOrId ?? undefined,
          table_id: route.value?.params?.viewId ?? undefined,
          view_id: route.value?.params?.viewTitle ?? undefined,
        })
      } catch {}
    },
  }

  /*
  // skip page event tracking for now
  router.afterEach((to, from) => {
    if (to.path === from.path && (to.query && to.query.type) === (from.query && from.query.type)) return

    const path = to.matched[to.matched.length - 1].path + (to.query && to.query.type ? `?type=${to.query.type}` : '')
    tele.emit('$pageview', {
      $current_url: path,
      base_id: route.value?.params?.baseId,
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

  // put inside app:created hook to ensure global state is available
  nuxtApp.hooks.hook('app:created', () => {
    const globalState = useGlobal()

    // if tele enabled at some point, init Posthog
    until(() => globalState?.appInfo?.value?.teleEnabled)
      .toBeTruthy({ timeout: 300000 })
      .then(() => {
        isTeleEnabled = globalState?.appInfo?.value?.teleEnabled
        if (clientId) initPostHog(clientId)
      })
      .catch(() => {
        isTeleEnabled = false
      })
  })
})

function sanitisePath(path?: string) {
  return path?.toString?.().replace(/(?:\?|\(\)|\(\.\*\)\*)(?=\/|$)/g, '')
}
