/**
 * Unit tests for `runPostInsertBookkeeping` — the guard `insertRow` (grid "Add row" /
 * "Duplicate row") wraps its post-insert UI bookkeeping in.
 *
 * Repro of #13002: the row-insert API call succeeds and the row is committed to the
 * database, but a later, purely local step (cache-index shifting, row-color/button
 * formula evaluation, aggregate reload) throws. Before this fix that error fell into
 * the same catch block as the API call itself, so the user saw "Failed to insert row"
 * / "Add row failed: Some internal error occurred" even though the row was created.
 *
 * `runPostInsertBookkeeping` isolates that step: its failures are logged, never
 * re-thrown, so they can never reach the toast that reports a genuine insert failure.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'

// `~/composables/useInfiniteData` transitively imports `~/utils/dataUtils`, which
// references the Nuxt auto-imported `iconMap` global at module-eval time. Provide a
// stub before importing so the module can load under vitest.
;(globalThis as any).iconMap = new Proxy({}, { get: () => undefined })

let runPostInsertBookkeeping: typeof import('~/composables/useInfiniteData')['runPostInsertBookkeeping']

beforeAll(async () => {
  ;({ runPostInsertBookkeeping } = await import('~/composables/useInfiniteData'))
})

describe('runPostInsertBookkeeping', () => {
  it('runs the bookkeeping callback and does not throw on success', () => {
    const bookkeeping = vi.fn()

    expect(() => runPostInsertBookkeeping(bookkeeping)).not.toThrow()
    expect(bookkeeping).toHaveBeenCalledTimes(1)
  })

  it('swallows an error thrown by the bookkeeping callback instead of propagating it — regression for #13002', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const bookkeeping = vi.fn(() => {
      throw new Error('row-color formula evaluation blew up')
    })

    // The row was already inserted successfully by this point — a bookkeeping
    // failure must never bubble up and be mistaken for an insert failure.
    expect(() => runPostInsertBookkeeping(bookkeeping)).not.toThrow()
    expect(bookkeeping).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledTimes(1)

    consoleError.mockRestore()
  })

  it('still runs bookkeeping side effects up to the point where it throws', () => {
    const sideEffects: string[] = []

    runPostInsertBookkeeping(() => {
      sideEffects.push('cache-updated')
      throw new Error('aggregate reload failed')
    })

    expect(sideEffects).toEqual(['cache-updated'])
  })
})
