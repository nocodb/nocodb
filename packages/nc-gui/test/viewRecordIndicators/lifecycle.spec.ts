import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type EffectScope, effectScope, ref } from 'vue'
import { useViewRecordIndicators } from 'nocodb:useViewRecordIndicators'
import { DEFAULT_VIEW_RECORD_INDICATORS } from 'nocodb:viewRecordIndicators'
import type { ViewRecordIndicatorSettings } from '../../lib/viewRecordIndicators'
import type { ViewRecordIndicatorTarget } from '../../composables/useViewRecordIndicators'

interface Result {
  count?: number | string
}
const HOUR = 3_600_000
const scopes: EffectScope[] = []
const identity = () => ({ userId: 'user', baseId: 'base', tableId: 'table', viewId: 'view' })
const enabled = (): ViewRecordIndicatorSettings => ({ ...DEFAULT_VIEW_RECORD_INDICATORS, showCount: true })
function deferred() {
  let resolve!: (result: Result) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<Result>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  return { promise, resolve, reject }
}
function harness(
  load = vi.fn(async (_target: ViewRecordIndicatorTarget, _signal: AbortSignal): Promise<Result> => ({ count: 2 })),
  target = ref<ViewRecordIndicatorTarget | null>(identity()),
  settings = ref(enabled()),
  provider: object = load,
) {
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => useViewRecordIndicators(target, settings, load, provider))!
  return { state, scope, load, target, settings }
}
const flush = () => vi.advanceTimersByTimeAsync(0)
beforeEach(() => vi.useFakeTimers())
afterEach(async () => {
  scopes.splice(0).forEach((scope) => scope.stop())
  await flush()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('view count lifecycle', () => {
  it('does no work when both preferences are off or identity is missing', async () => {
    const off = harness(undefined, ref(identity()), ref({ ...DEFAULT_VIEW_RECORD_INDICATORS }))
    const missing = harness(undefined, ref(null))
    await flush()
    expect(off.load).not.toHaveBeenCalled()
    expect(missing.load).not.toHaveBeenCalled()
    expect(off.state.status.value).toBe('disabled')
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([0, '0', 2, '12'])('keeps ready count %j distinct from loading', async (count) => {
    const result = deferred()
    const load = vi.fn((_target: ViewRecordIndicatorTarget, _signal: AbortSignal) => result.promise)
    const h = harness(load)
    await flush()
    expect(h.state.status.value).toBe('loading')
    expect(h.state.count.value).toBeUndefined()
    result.resolve({ count })
    await flush()
    expect(h.state.status.value).toBe('ready')
    expect(h.state.count.value).toBe(Number(count))
  })

  it.each([undefined, -1, 1.5, NaN, Infinity, 'not a count'])(
    'reports malformed response %j as an error, not zero',
    async (count) => {
      const h = harness(vi.fn(async () => ({ count })))
      await flush()
      expect(h.state.status.value).toBe('error')
      expect(h.state.count.value).toBeUndefined()
    },
  )

  it('retries an error after the configured delay', async () => {
    const h = harness(
      vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ count: 0 }),
      ref(identity()),
      ref({ ...enabled(), refreshUnit: 'hours' }),
    )
    await flush()
    expect(h.state.status.value).toBe('error')
    expect(h.state.error.value).toBeInstanceOf(Error)
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(h.state.status.value).toBe('ready')
    expect(h.state.count.value).toBe(0)
  })

  it.each(['userId', 'baseId', 'tableId', 'viewId'] as const)('rejects late results after %s changes', async (key) => {
    const old = deferred()
    const current = deferred()
    const load = vi
      .fn()
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => current.promise)
    const h = harness(load)
    await flush()
    const signal = load.mock.calls[0][1] as AbortSignal
    h.target.value = { ...identity(), [key]: 'new-value' }
    await flush()
    expect(signal.aborted).toBe(true)
    old.resolve({ count: 99 })
    await flush()
    expect(h.state.status.value).toBe('loading')
    expect(h.state.count.value).toBeUndefined()
    current.resolve({ count: 3 })
    await flush()
    expect(h.state.count.value).toBe(3)
    expect(load.mock.calls[1][0][key]).toBe('new-value')
  })

  it('deduplicates the same identity and aborts only after its final subscriber leaves', async () => {
    const result = deferred()
    const load = vi.fn((_target: ViewRecordIndicatorTarget, _signal: AbortSignal) => result.promise)
    const first = harness(load)
    const second = harness(load)
    await flush()
    expect(load).toHaveBeenCalledTimes(1)
    const signal = load.mock.calls[0][1]
    first.scope.stop()
    expect(signal.aborted).toBe(false)
    result.resolve({ count: 5 })
    await flush()
    expect(second.state.count.value).toBe(5)
    second.scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds concurrent work and removes a cancelled queued view', async () => {
    const pending: ReturnType<typeof deferred>[] = []
    const load = vi.fn((_target: ViewRecordIndicatorTarget, _signal: AbortSignal) => {
      const result = deferred()
      pending.push(result)
      return result.promise
    })
    const instances = Array.from({ length: 7 }, (_, i) => harness(load, ref({ ...identity(), viewId: `view-${i}` })))
    await flush()
    expect(load).toHaveBeenCalledTimes(4)
    instances[4].scope.stop()
    pending[0].resolve({ count: 2 })
    await flush()
    expect(load).toHaveBeenCalledTimes(5)
    expect(load.mock.calls[4][0].viewId).toBe('view-5')
    expect(load.mock.calls.some(([target]) => target.viewId === 'view-4')).toBe(false)
  })

  it('starts its next timeout after completion and never overlaps a slow request', async () => {
    const pending = deferred()
    const load = vi
      .fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue({ count: 3 })
    harness(load, ref(identity()), ref({ ...enabled(), refreshUnit: 'hours' }))
    await flush()
    await vi.advanceTimersByTimeAsync(10 * HOUR)
    expect(load).toHaveBeenCalledTimes(1)
    pending.resolve({ count: 2 })
    await flush()
    await vi.advanceTimersByTimeAsync(HOUR - 1)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('does not refetch for display-only toggle changes while still enabled', async () => {
    const h = harness()
    await flush()
    h.settings.value.boldNonEmpty = true
    h.settings.value.showCount = false
    await flush()
    expect(h.load).toHaveBeenCalledTimes(1)
    expect(h.state.count.value).toBe(2)
  })

  it('cleans up on disable and unmount and applies a changed interval', async () => {
    const h = harness(undefined, ref(identity()), ref({ ...enabled(), refreshUnit: 'hours' }))
    await flush()
    h.settings.value.refreshAmount = 2
    await flush()
    expect(h.load).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(h.load).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(h.load).toHaveBeenCalledTimes(3)
    h.settings.value.showCount = false
    await flush()
    expect(h.state.status.value).toBe('disabled')
    expect(h.state.count.value).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
    h.scope.stop()
    await vi.advanceTimersByTimeAsync(48 * HOUR)
    expect(h.load).toHaveBeenCalledTimes(3)
  })

  it('chunks a long safe interval without overflowing setTimeout', async () => {
    const h = harness(undefined, ref(identity()), ref({ ...enabled(), refreshAmount: 30 }))
    await flush()
    await vi.advanceTimersByTimeAsync(2 ** 31 - 1)
    expect(h.load).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(30 * 24 * HOUR - (2 ** 31 - 1))
    expect(h.load).toHaveBeenCalledTimes(2)
  })

  it('does not retain a completed count across a later mount', async () => {
    const first = harness()
    await flush()
    first.scope.stop()
    const second = harness(first.load)
    expect(second.state.count.value).toBeUndefined()
    await flush()
    expect(first.load).toHaveBeenCalledTimes(2)
  })
})

describe('request subscription isolation', () => {
  it.each(['userId', 'baseId', 'tableId', 'viewId'] as const)(
    'does not deduplicate simultaneous distinct %s values',
    async (key) => {
      const first = deferred()
      const second = deferred()
      const load = vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise)
      const a = harness(load)
      const b = harness(load, ref({ ...identity(), [key]: 'different' }))
      await flush()
      expect(load).toHaveBeenCalledTimes(2)
      first.resolve({ count: 1 })
      second.resolve({ count: 8 })
      await flush()
      expect(a.state.count.value).toBe(1)
      expect(b.state.count.value).toBe(8)
    },
  )

  it('aborts the final pending subscriber and ignores a later result after disabling', async () => {
    const pending = deferred()
    const load = vi.fn((_target: ViewRecordIndicatorTarget, _signal: AbortSignal) => pending.promise)
    const h = harness(load)
    await flush()
    const signal = load.mock.calls[0][1]
    h.settings.value.showCount = false
    expect(signal.aborted).toBe(true)
    pending.resolve({ count: 99 })
    await flush()
    expect(h.state.status.value).toBe('disabled')
    expect(h.state.count.value).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(48 * HOUR)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('clears a previously ready value if a refresh fails', async () => {
    const h = harness(vi.fn().mockResolvedValueOnce({ count: 8 }).mockRejectedValue(new Error('offline')))
    await flush()
    expect(h.state.count.value).toBe(8)
    h.state.refresh()
    expect(h.state.count.value).toBeUndefined()
    await flush()
    expect(h.state.status.value).toBe('error')
    expect(h.state.count.value).toBeUndefined()
  })
})

it('uses actual elapsed time when a long-delay chunk fires late', async () => {
  const h = harness(undefined, ref(identity()), ref({ ...enabled(), refreshAmount: 30 }))
  await flush()
  vi.setSystemTime(Date.now() + 10 * 24 * HOUR)
  await vi.advanceTimersByTimeAsync(2 ** 31 - 1)
  expect(h.load).toHaveBeenCalledTimes(2)
})

describe('provider scheduler boundaries', () => {
  it('does not share equal identities across different API providers', async () => {
    const a = harness(
      vi.fn(async () => ({ count: 1 })),
      ref(identity()),
      ref(enabled()),
      {},
    )
    const b = harness(
      vi.fn(async () => ({ count: 9 })),
      ref(identity()),
      ref(enabled()),
      {},
    )
    await flush()
    expect(a.load).toHaveBeenCalledTimes(1)
    expect(b.load).toHaveBeenCalledTimes(1)
    expect(a.state.count.value).toBe(1)
    expect(b.state.count.value).toBe(9)
  })

  it('retains actual in-flight slots when aborted loaders ignore their signals', async () => {
    const provider = {}
    const pending: ReturnType<typeof deferred>[] = []
    const load = vi.fn((_target: ViewRecordIndicatorTarget, _signal: AbortSignal) => {
      const result = deferred()
      pending.push(result)
      return result.promise
    })
    const first = Array.from({ length: 4 }, (_, i) =>
      harness(load, ref({ ...identity(), viewId: `old-${i}` }), ref(enabled()), provider),
    )
    await flush()
    first.forEach((h) => h.scope.stop())
    expect(load.mock.calls.every(([, signal]) => signal.aborted)).toBe(true)
    const later = harness(load, ref({ ...identity(), viewId: 'later' }), ref(enabled()), provider)
    await flush()
    expect(load).toHaveBeenCalledTimes(4)
    expect(later.state.status.value).toBe('loading')
    pending[0].resolve({ count: 99 })
    await flush()
    expect(load).toHaveBeenCalledTimes(5)
    expect(load.mock.calls[4][0].viewId).toBe('later')
    pending[4].resolve({ count: 2 })
    pending.slice(1, 4).forEach((request) => request.resolve({ count: 99 }))
    await flush()
    expect(later.state.count.value).toBe(2)
  })
})
