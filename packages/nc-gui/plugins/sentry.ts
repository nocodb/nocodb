// ref: https://localazy.com/blog/nuxt-3-tailwind-i18n-eslint-starter#add-sentry
//      https://docs.sentry.io/platforms/javascript/guides/vue/
import * as Sentry from '@sentry/vue'
import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin((nuxtApp) => {
  if (isEeUI) return

  const { vueApp } = nuxtApp

  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development'

  if (process.env.CI || process.env.PLAYWRIGHT) {
    return
  }

  if (env !== 'production' && !process.env.NC_ENABLE_DEV_SENTRY) {
    return
  }

  let initialized = false

  const init = () => {
    // prevent multiple init
    if (initialized) return
    initialized = true

    Sentry.init({
      app: [vueApp],
      dsn: 'https://64cb4904bcbec03a1b9a0be02a2d10a9@o4505953073889280.ingest.us.sentry.io/4507725383663616',
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
    () => (nuxtApp.$state as ReturnType<typeof useGlobal>).appInfo?.value?.errorReportingEnabled,
    (enabled) => {
      try {
        if (enabled) init()
      } catch (e) {
        // ignore
      }
    },
    { immediate: true },
  )
})
