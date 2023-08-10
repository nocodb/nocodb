// Returns a blob:// URL which points
// to a javascript file which will call
// importScripts with the given URL
export function getWorkerURL(url: string) {
  const content = `importScripts( "${url}" );`
  return URL.createObjectURL(new Blob([content], { type: 'text/javascript' }))
}

export function initWorker(url: string) {
  let worker: Worker | null = null
  try {
    if (/^https?:\/\/'/.test(url)) {
      const worker_url = getWorkerURL(url)
      worker = new Worker(worker_url)
      URL.revokeObjectURL(worker_url)
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
