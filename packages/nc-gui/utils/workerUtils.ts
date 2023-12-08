import getCrossOriginWorkerURL from 'crossoriginworker'

export async function initWorker(url: string) {
  let worker: Worker | null = null
  try {
    if (/^https?:\/\//.test(url)) {
      const workerURL = await getCrossOriginWorkerURL(url)
      worker = new Worker(workerURL)
    } else {
      worker = new Worker(url, {
        type: 'module',
      })
    }
  } catch (e) {
    console.error(e)
  }
  return worker
}
