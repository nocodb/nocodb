export interface ViewRecordCountSettings {
  showCount: boolean
  boldWhenNonEmpty: boolean
  refreshInterval: number
  refreshUnit: 'hours' | 'days'
}

export interface ViewRecordCountTarget {
  baseId: string
  tableId: string
  viewId: string
  roleScope?: string
}

export interface ViewRecordCountEntry {
  count?: number
  checkedAt: number
  retryAt?: number
  forbidden?: boolean
}

const HOUR = 60 * 60 * 1000
const RETRY_DELAY = 5 * 60 * 1000

function readMeta(meta: unknown): Record<string, unknown> {
  if (typeof meta === 'string') {
    try {
      return readMeta(JSON.parse(meta))
    } catch {
      return {}
    }
  }
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {}
}

export function normalizeViewRecordCountSettings(meta: unknown): ViewRecordCountSettings {
  const settings = readMeta(readMeta(meta).recordCount)
  const refreshUnit = settings.refreshUnit === 'hours' ? 'hours' : 'days'
  const maxInterval = refreshUnit === 'hours' ? 24 * 365 : 365
  const interval = settings.refreshInterval

  return {
    showCount: settings.showCount === true,
    boldWhenNonEmpty: settings.boldWhenNonEmpty === true,
    refreshInterval:
      typeof interval === 'number' && Number.isInteger(interval) && interval >= 1 && interval <= maxInterval ? interval : 1,
    refreshUnit,
  }
}

export function viewRecordCountRefreshMs(settings: ViewRecordCountSettings): number {
  const normalized = normalizeViewRecordCountSettings({ recordCount: settings })
  return normalized.refreshInterval * (normalized.refreshUnit === 'hours' ? HOUR : 24 * HOUR)
}

export function mergeViewRecordCountSettings(meta: unknown, settings: ViewRecordCountSettings): Record<string, unknown> {
  return {
    ...readMeta(meta),
    recordCount: normalizeViewRecordCountSettings({ recordCount: settings }),
  }
}

export function viewRecordCountKey(target: ViewRecordCountTarget): string {
  return JSON.stringify([target.baseId, target.tableId, target.viewId, target.roleScope])
}

/** Counts depend on the current user's row permissions; callers must clear on identity/role changes. */
export function createViewRecordCountCache(
  fetchCount: (target: ViewRecordCountTarget) => Promise<number | string | undefined>,
  onChange: () => void = () => {},
  now: () => number = Date.now,
) {
  const entries = new Map<string, ViewRecordCountEntry>()
  const pending = new Map<string, { promise: Promise<void>; consumers: Array<() => boolean> }>()
  const queue: Array<() => void> = []
  let running = 0
  let generation = 0

  const get = (target: ViewRecordCountTarget) => entries.get(viewRecordCountKey(target))

  async function acquire() {
    if (running < 4) running++
    else await new Promise<void>((resolve) => queue.push(resolve))
  }

  function release() {
    const next = queue.shift()
    if (next) next()
    else running--
  }

  async function load(target: ViewRecordCountTarget, refreshMs: number, isActive: () => boolean = () => true): Promise<void> {
    const key = viewRecordCountKey(target)
    const previous = entries.get(key)
    if (previous?.forbidden) return
    if (previous?.retryAt && previous.retryAt > now()) return
    if (previous?.count !== undefined && now() - previous.checkedAt < refreshMs) return
    const existing = pending.get(key)
    if (existing) {
      existing.consumers.push(isActive)
      return existing.promise
    }

    const currentGeneration = generation
    const consumers = [isActive]
    const request = Promise.resolve()
      .then(async () => {
        await acquire()
        try {
          // A queued node may have disappeared or lost access while another request was running.
          if (currentGeneration !== generation || !consumers.some((consumer) => consumer())) return
          const value = await fetchCount(target)
          // Some SQL drivers return COUNT as a string. Empty/null/unsafe values are not zero.
          const count = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
          if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
            throw new Error('Invalid view record count')
          }
          if (currentGeneration === generation && consumers.some((consumer) => consumer())) {
            entries.set(key, { count, checkedAt: now() })
          }
        } finally {
          release()
        }
      })
      .catch((error: unknown) => {
        if (currentGeneration !== generation || !consumers.some((consumer) => consumer())) return
        const status =
          (error as { response?: { status?: number }; status?: number })?.response?.status ??
          (error as { status?: number })?.status
        const forbidden = status === 401 || status === 403 || status === 404
        entries.set(key, {
          checkedAt: now(),
          forbidden,
          retryAt: forbidden ? undefined : now() + RETRY_DELAY,
        })
      })
      .finally(() => {
        if (currentGeneration !== generation) return
        pending.delete(key)
        onChange()
      })
    pending.set(key, { promise: request, consumers })
    return request
  }

  function clear() {
    generation++
    entries.clear()
    pending.clear()
    onChange()
  }

  return { get, load, clear }
}
