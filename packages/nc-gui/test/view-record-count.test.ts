import { describe, expect, it, vi } from 'vitest'
import {
  createViewRecordCountCache,
  mergeViewRecordCountSettings,
  normalizeViewRecordCountSettings,
  viewRecordCountRefreshMs,
} from '~/utils/viewRecordCount'

const target = { baseId: 'base-1', tableId: 'table-1', viewId: 'missing-invoice' }
const hour = 60 * 60 * 1000

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('saved view record count settings', () => {
  it('keeps existing views opted out and defaults the refresh interval to one day', () => {
    for (const meta of [undefined, null, '', '{}', {}, { unrelated: true }]) {
      expect(normalizeViewRecordCountSettings(meta)).toEqual({
        showCount: false,
        boldWhenNonEmpty: false,
        refreshInterval: 1,
        refreshUnit: 'days',
      })
    }
  })

  it('reads either serialized or parsed metadata and supports bold-only views', () => {
    const settings = { showCount: false, boldWhenNonEmpty: true, refreshInterval: 2, refreshUnit: 'hours' }
    expect(normalizeViewRecordCountSettings({ recordCount: settings })).toEqual(settings)
    expect(normalizeViewRecordCountSettings(JSON.stringify({ recordCount: settings }))).toEqual(settings)
    expect(viewRecordCountRefreshMs(normalizeViewRecordCountSettings({ recordCount: settings }))).toBe(2 * hour)
  })

  it('retains unrelated view metadata when updating the options', () => {
    const meta = { icon: 'existing-icon', description: 'Keep me', custom: { enabled: true } }
    const before = JSON.stringify(meta)
    const settings = { showCount: true, boldWhenNonEmpty: true, refreshInterval: 3, refreshUnit: 'days' as const }
    expect(mergeViewRecordCountSettings(meta, settings)).toEqual({ ...meta, recordCount: settings })
    expect(mergeViewRecordCountSettings(before, settings)).toEqual({ ...meta, recordCount: settings })
    expect(JSON.stringify(meta)).toBe(before)
  })

  it('rejects coercible booleans and prevents malformed intervals from creating rapid polling', () => {
    for (const interval of [0, -1, NaN, Infinity, '', 'bad', null]) {
      const settings = normalizeViewRecordCountSettings({
        recordCount: { showCount: 'false', boldWhenNonEmpty: 1, refreshInterval: interval, refreshUnit: 'milliseconds' },
      })
      expect(settings.showCount).toBe(false)
      expect(settings.boldWhenNonEmpty).toBe(false)
      expect(viewRecordCountRefreshMs(settings)).toBeGreaterThanOrEqual(hour)
      expect(Number.isFinite(viewRecordCountRefreshMs(settings))).toBe(true)
    }
    expect(() => normalizeViewRecordCountSettings('{bad json')).not.toThrow()
  })
})

describe('view count requests and cache', () => {
  it('loads an opted-in view once, retains zero as a real result, and honors the chosen interval', async () => {
    let now = 1000
    const fetchCount = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(5)
    const cache = createViewRecordCountCache(fetchCount, undefined, () => now)
    expect(cache.get(target)?.count).toBeUndefined()
    await cache.load(target, hour)
    expect(fetchCount).toHaveBeenCalledWith(target)
    expect(cache.get(target)?.count).toBe(0)
    now += hour - 1
    await cache.load(target, hour)
    expect(fetchCount).toHaveBeenCalledTimes(1)
    now += 1
    await cache.load(target, hour)
    expect(fetchCount).toHaveBeenCalledTimes(2)
    expect(cache.get(target)?.count).toBe(5)
  })

  it('deduplicates requests from simultaneous consumers', async () => {
    const request = deferred<number>()
    const fetchCount = vi.fn(() => request.promise)
    const cache = createViewRecordCountCache(fetchCount)
    const first = cache.load(target, hour)
    const second = cache.load(target, hour)
    request.resolve(4)
    await Promise.all([first, second])
    expect(fetchCount).toHaveBeenCalledTimes(1)
    expect(cache.get(target)?.count).toBe(4)
  })

  it('isolates counts for separate bases, tables, and filtered views', async () => {
    const fetchCount = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(4).mockResolvedValueOnce(6).mockResolvedValueOnce(8)
    const cache = createViewRecordCountCache(fetchCount)
    const targets = [
      target,
      { ...target, baseId: 'base-2' },
      { ...target, tableId: 'table-2' },
      { ...target, viewId: 'completed-jobs' },
    ]
    for (const scoped of targets) await cache.load(scoped, hour)
    expect(targets.map((scoped) => cache.get(scoped)?.count)).toEqual([2, 4, 6, 8])
  })

  it('does not present a failed or malformed count as zero', async () => {
    for (const result of [undefined, null, NaN, Infinity, -1, 1.5, '', ' ', '2.5', 'not-a-count', true]) {
      const cache = createViewRecordCountCache(vi.fn().mockResolvedValue(result))
      await cache.load(target, hour)
      expect(cache.get(target)?.count).toBeUndefined()
    }
    const cache = createViewRecordCountCache(vi.fn().mockRejectedValue(new Error('permission denied')))
    await cache.load(target, hour)
    expect(cache.get(target)?.count).toBeUndefined()
  })

  it('accepts integer strings returned by SQL drivers', async () => {
    const cache = createViewRecordCountCache(vi.fn().mockResolvedValueOnce('12'))
    await cache.load(target, hour)
    expect(cache.get(target)?.count).toBe(12)
  })

  it('retries temporary failures without polling repeatedly or waiting the full daily interval', async () => {
    let now = 1000
    const fetchCount = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(3)
    const cache = createViewRecordCountCache(fetchCount, undefined, () => now)
    await cache.load(target, 24 * hour)
    now += 1000
    await cache.load(target, 24 * hour)
    expect(fetchCount).toHaveBeenCalledTimes(1)
    now += 5 * 60 * 1000
    await cache.load(target, 24 * hour)
    expect(fetchCount).toHaveBeenCalledTimes(2)
    expect(cache.get(target)?.count).toBe(3)
  })

  it('does not show an old count after a failed refresh', async () => {
    let now = 1000
    const fetchCount = vi.fn().mockResolvedValueOnce(7).mockRejectedValueOnce(new Error('offline'))
    const cache = createViewRecordCountCache(fetchCount, undefined, () => now)
    await cache.load(target, hour)
    expect(cache.get(target)?.count).toBe(7)
    now += hour
    await cache.load(target, hour)
    expect(cache.get(target)?.count).toBeUndefined()
  })

  it('invalidates cached counts and ignores pending responses when access changes', async () => {
    const oldRequest = deferred<number>()
    const fetchCount = vi.fn().mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce(1)
    const cache = createViewRecordCountCache(fetchCount)
    const pending = cache.load(target, hour)
    await vi.waitFor(() => expect(fetchCount).toHaveBeenCalledTimes(1))
    cache.clear()
    await cache.load(target, hour)
    expect(cache.get(target)?.count).toBe(1)
    oldRequest.resolve(999)
    await pending
    expect(cache.get(target)?.count).toBe(1)
    cache.clear()
    expect(cache.get(target)?.count).toBeUndefined()
  })

  it('limits concurrent counts across distinct views and skips hidden queued nodes', async () => {
    const requests = Array.from({ length: 4 }, () => deferred<number>())
    let started = 0
    let lastVisible = true
    const fetchCount = vi.fn(() => requests[started++].promise)
    const cache = createViewRecordCountCache(fetchCount)
    const loads = Array.from({ length: 5 }, (_, index) =>
      cache.load({ ...target, viewId: `view-${index}` }, hour, () => index < 4 || lastVisible),
    )
    await vi.waitFor(() => expect(fetchCount).toHaveBeenCalledTimes(4))
    lastVisible = false
    for (const request of requests) request.resolve(1)
    await Promise.all(loads)
    expect(fetchCount).toHaveBeenCalledTimes(4)
    expect(cache.get({ ...target, viewId: 'view-4' })?.count).toBeUndefined()
  })

  it('does not keep retrying denied or removed views', async () => {
    for (const status of [401, 403, 404]) {
      let now = 1000
      const fetchCount = vi.fn().mockRejectedValue({ response: { status } })
      const cache = createViewRecordCountCache(fetchCount, undefined, () => now)
      await cache.load(target, hour)
      now += 48 * hour
      await cache.load(target, hour)
      expect(fetchCount).toHaveBeenCalledTimes(1)
      expect(cache.get(target)?.count).toBeUndefined()
      cache.clear()
      await cache.load(target, hour)
      expect(fetchCount).toHaveBeenCalledTimes(2)
    }
  })
})
