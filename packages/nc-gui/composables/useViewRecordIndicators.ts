import { computed, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { ViewRecordIndicatorSettings } from '~/lib/viewRecordIndicators'
import { readViewRecordIndicators } from '~/lib/viewRecordIndicators'

export interface ViewRecordIndicatorTarget {
  userId: string
  baseId: string
  tableId: string
  viewId: string
}

type CountLoader = (target: ViewRecordIndicatorTarget, signal: AbortSignal) => Promise<{ count?: number | string }>
type IndicatorStatus = 'disabled' | 'loading' | 'ready' | 'error'
interface Listener {
  resolve: (count: number) => void
  reject: (error: unknown) => void
}
interface CountJob {
  key: string
  target: ViewRecordIndicatorTarget
  load: CountLoader
  controller: AbortController
  listeners: Set<Listener>
  running: boolean
}

const MAX_CONCURRENT_REQUESTS = 4
const MAX_TIMEOUT_MS = 2 ** 31 - 1
const HOUR_MS = 60 * 60 * 1000
const schedulers = new WeakMap<object, ReturnType<typeof createScheduler>>()

function targetKey(target: ViewRecordIndicatorTarget): string {
  return JSON.stringify([target.userId, target.baseId, target.tableId, target.viewId])
}

function normalizedCount(result: { count?: number | string }): number {
  const value = typeof result?.count === 'string' && /^\d+$/.test(result.count.trim()) ? Number(result.count) : result?.count
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid view record count')
  return value
}

function createScheduler() {
  const jobs = new Map<string, CountJob>()
  const queue: CountJob[] = []
  let activeRequests = 0

  async function runJob(job: CountJob) {
    job.running = true
    activeRequests++
    try {
      if (job.controller.signal.aborted) throw new DOMException('View count request cancelled', 'AbortError')
      // Keep the slot until the real loader settles, even if it ignores cancellation.
      const result = await job.load(job.target, job.controller.signal)
      const count = normalizedCount(result)
      if (jobs.get(job.key) === job) jobs.delete(job.key)
      for (const listener of [...job.listeners]) listener.resolve(count)
    } catch (error) {
      if (jobs.get(job.key) === job) jobs.delete(job.key)
      for (const listener of [...job.listeners]) listener.reject(error)
    } finally {
      job.listeners.clear()
      activeRequests--
      drainQueue()
    }
  }

  function drainQueue() {
    while (activeRequests < MAX_CONCURRENT_REQUESTS && queue.length) {
      const job = queue.shift()!
      if (job.listeners.size && !job.controller.signal.aborted) runJob(job)
    }
  }

  return function subscribeCount(target: ViewRecordIndicatorTarget, load: CountLoader, listener: Listener): () => void {
    const key = targetKey(target)
    let job = jobs.get(key)
    if (!job) {
      job = { key, target: { ...target }, load, controller: new AbortController(), listeners: new Set(), running: false }
      jobs.set(key, job)
      queue.push(job)
    }
    job.listeners.add(listener)
    drainQueue()
    return () => {
      job.listeners.delete(listener)
      if (job.listeners.size) return
      if (jobs.get(key) === job) jobs.delete(key)
      if (!job.running) {
        const index = queue.indexOf(job)
        if (index !== -1) queue.splice(index, 1)
      }
      job.controller.abort()
    }
  }
}

export function useViewRecordIndicators(
  target: MaybeRefOrGetter<ViewRecordIndicatorTarget | null>,
  settings: MaybeRefOrGetter<ViewRecordIndicatorSettings>,
  loadCount: CountLoader,
  provider: object = loadCount,
) {
  const subscribeCount = schedulers.get(provider) ?? createScheduler()
  schedulers.set(provider, subscribeCount)
  const currentSettings = computed(() => readViewRecordIndicators({ sidebarIndicators: toValue(settings) }))
  const enabled = computed(() => currentSettings.value.showCount || currentSettings.value.boldNonEmpty)
  const intervalMs = computed(
    () => currentSettings.value.refreshAmount * HOUR_MS * (currentSettings.value.refreshUnit === 'days' ? 24 : 1),
  )
  const count = ref<number>()
  const status = ref<IndicatorStatus>('disabled')
  const error = shallowRef<unknown>()
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let release: (() => void) | undefined

  function cancel() {
    generation++
    clearTimeout(timer)
    timer = undefined
    release?.()
    release = undefined
  }

  function schedule(remaining: number) {
    const delay = Math.min(remaining, MAX_TIMEOUT_MS)
    const started = Date.now()
    timer = setTimeout(() => {
      timer = undefined
      const elapsed = Math.max(delay, Date.now() - started)
      if (remaining > elapsed) schedule(remaining - elapsed)
      else refresh()
    }, delay)
  }

  function refresh() {
    cancel()
    count.value = undefined
    error.value = undefined
    const identity = toValue(target)
    if (
      !enabled.value ||
      !identity ||
      [identity.userId, identity.baseId, identity.tableId, identity.viewId].some((value) => typeof value !== 'string' || !value)
    ) {
      status.value = 'disabled'
      return
    }
    const requestGeneration = generation
    status.value = 'loading'
    release = subscribeCount(identity, loadCount, {
      resolve(value) {
        if (requestGeneration !== generation) return
        release = undefined
        count.value = value
        status.value = 'ready'
        schedule(intervalMs.value)
      },
      reject(reason) {
        if (requestGeneration !== generation) return
        release = undefined
        error.value = reason
        status.value = 'error'
        schedule(intervalMs.value)
      },
    })
  }

  const stop = watch(
    [
      () => toValue(target)?.userId,
      () => toValue(target)?.baseId,
      () => toValue(target)?.tableId,
      () => toValue(target)?.viewId,
      enabled,
      intervalMs,
    ],
    refresh,
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => {
    stop()
    cancel()
  })

  return { count, status, error, refresh }
}
