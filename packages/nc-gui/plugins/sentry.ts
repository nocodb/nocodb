// ref: https://localazy.com/blog/nuxt-3-tailwind-i18n-eslint-starter#add-sentry
//      https://docs.sentry.io/platforms/javascript/guides/vue/
import * as Sentry from '@sentry/vue'
import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin((nuxtApp) => {
  if (isEeUI) return

  const config = useRuntimeConfig()

  const { vueApp } = nuxtApp

  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development'

  if (config.public.env === 'CI') {
    return
  }

  if (env !== 'production' && !process.env.NC_ENABLE_DEV_SENTRY) {
    return
  }

  let initialized = false

  const init = (dsn: string) => {
    // prevent multiple init
    if (initialized) return
    initialized = true

    Sentry.init({
      app: [vueApp],
      dsn,
      environment: env,
      integrations: [
        new Sentry.BrowserTracing({
          tracingOrigins: ['*'],
          routingInstrumentation: Sentry.vueRouterInstrumentation(nuxtApp.$router),
        }),
      ],
      beforeSend(event) {
        if (process.env.NODE_ENV === 'production') {
          event.extra = event.extra || {}
          try {
            // set additional context
            const appInfo = (nuxtApp.$state as ReturnType<typeof useGlobal>).appInfo.value
            event.extra.version = appInfo?.version
          } catch {
            // ignore
          }
          return event
        }
        return null
      },
      autoSessionTracking: false,
      tracesSampleRate: 0.5,
    })
  }

  // load sentry only if enabled
  watch(
    [
      () => (nuxtApp.$state as ReturnType<typeof useGlobal>).appInfo?.value?.errorReportingEnabled,
      () => (nuxtApp.$state as ReturnType<typeof useGlobal>).appInfo?.value?.sentryDSN,
    ],
    ([enabled, sentryDSN]) => {
      try {
        if (enabled && sentryDSN) init(sentryDSN)
      } catch {
        // ignore
      }
    },
    { immediate: true },
  )
})
