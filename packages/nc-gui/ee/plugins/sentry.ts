// ref: https://localazy.com/blog/nuxt-3-tailwind-i18n-eslint-starter#add-sentry
//      https://docs.sentry.io/platforms/javascript/guides/vue/
import * as Sentry from '@sentry/vue'
import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin((nuxtApp) => {
  const { vueApp } = nuxtApp

  Sentry.init({
    app: [vueApp],
    dsn: 'https://0da0f8ab4bc2afc11ee510490f452b22@o4505953073889280.ingest.sentry.io/4505953708867584',
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    integrations: [
      new Sentry.BrowserTracing({
        tracingOrigins: ['*'],
        routingInstrumentation: Sentry.vueRouterInstrumentation(nuxtApp.$router),
      }),
    ],
    beforeSend(event) {
      if (process.env.NODE_ENV === 'production') return event
      return null
    },
    autoSessionTracking: false,
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    // todo: change in production before release
    tracesSampleRate: 1.0,
  })

  // return {
  //   provide: {
  //     sentrySetContext: Sentry.setContext,
  //     sentrySetUser: Sentry.setUser,
  //     sentrySetTag: Sentry.setTag,
  //     sentryAddBreadcrumb: Sentry.addBreadcrumb,
  //     sentryCaptureException: Sentry.captureException,
  //   },
  // }
})
