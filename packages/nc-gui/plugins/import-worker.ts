// import worker script according to the doc of Vite
import getCrossOriginWorkerURL from 'crossoriginworker'
import importWorkerUrl from '~/workers/importWorker?worker&url'
const isWorkerSupport = typeof Worker !== 'undefined'

export default defineNuxtPlugin(async (nuxtApp) => {
  let workerInitializationPromise: Promise<Worker | null> | null = null

  const initializeWorker = async () => {
    if (workerInitializationPromise) {
      return workerInitializationPromise
    }

    workerInitializationPromise = (async () => {
      if (!isWorkerSupport) return null
      try {
        const worker = new Worker(
          await getCrossOriginWorkerURL(importWorkerUrl),
          process.env.NODE_ENV === 'development' ? { type: 'module' } : undefined,
        )

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
    terminate: () => {
      if (workerInitializationPromise) {
        workerInitializationPromise.then((worker) => {
          worker?.terminate()
        })
        workerInitializationPromise = null
      }
    },
  })
})
