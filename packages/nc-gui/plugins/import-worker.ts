// import worker script according to the doc of Vite
import ImportWorker from '~/workers/importWorker?worker'

const isWorkerSupport = typeof Worker !== 'undefined'
const isDevelopment = process.env.NODE_ENV === 'development'

export default defineNuxtPlugin(async (nuxtApp) => {
  let workerInitializationPromise: Promise<Worker | null> | null = null

  const initializeWorker = async () => {
    if (workerInitializationPromise) {
      return workerInitializationPromise
    }

    workerInitializationPromise = (async () => {
      if (!isWorkerSupport || isDevelopment) return null

      try {
        const worker = new ImportWorker()

        worker.onerror = (error) => {
          console.error('Import worker error:', error)
          workerInitializationPromise = null
        }

        return worker
      } catch (error) {
        console.error('Failed to create import worker:', error)
        workerInitializationPromise = null
        return null
      }
    })()

    return workerInitializationPromise
  }

  nuxtApp.provide('importWorker', {
    get: initializeWorker,
    terminate: async () => {
      if (workerInitializationPromise) {
        const worker = await workerInitializationPromise
        worker?.terminate()
        workerInitializationPromise = null
      }
    },
  })
})
