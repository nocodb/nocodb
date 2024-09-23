import * as Sentry from '@sentry/vue'
import type { Api } from 'nocodb-sdk'

class ErrorReporting {
  errors: Error[] = []

  // debounce error reporting to avoid sending multiple reports for the same error
  private report = useDebounceFn(
    () => {
      const errors = this.errors
        // filter out duplicate errors and only include 2 lines of stack trace
        .filter((error, index, self) => index === self.findIndex((t) => t.message === error.message))
        .map((error) => ({
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 2).join('\n'),
        }))
      this.errors = []
      this.$api.utils.errorReport({ errors, extra: {} })
    },
    3000,
    {
      maxWait: 10000,
    },
  )

  constructor(private $api: Api<unknown>) {}

  // collect error to report later
  collect(error: Error) {
    this.errors.push(error)
    // report errors after 3 seconds
    this.report().catch(() => {
      // do nothing
    })
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  if (isEeUI) {
    nuxtApp.provide('report', function (error: Error) {
      Sentry.captureException(error)
    })
    return
  }

  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development'
  let isSentryConfigured = false
  let isErrorReportingEnabled = false
  let errorReporting: ErrorReporting | null = null

  // load error reporting only if enabled and sentryDSN is not provided
  watch(
    [
      () => (nuxtApp.$state as ReturnType<typeof useGlobal>).appInfo?.value?.errorReportingEnabled,
      () => (nuxtApp.$state as ReturnType<typeof useGlobal>).appInfo?.value?.sentryDSN,
    ],
    ([enabled, sentryDSN]) => {
      isSentryConfigured = enabled && !!sentryDSN
      isErrorReportingEnabled = enabled
      if (enabled && !sentryDSN) {
        errorReporting = new ErrorReporting(nuxtApp.$api as Api<unknown>)
      } else {
        errorReporting = null
      }
    },
    { immediate: true },
  )

  function report(error: Error) {
    console.log(error)

    if (process.env.CI || process.env.PLAYWRIGHT) {
      return
    }

    if (env !== 'production' && !process.env.NC_ENABLE_DEV_SENTRY) {
      return
    }

    if (isSentryConfigured) {
      Sentry.captureException(error)
    } else if (isErrorReportingEnabled) {
      errorReporting?.collect(error)
    }
  }

  nuxtApp.provide('report', report)
})
