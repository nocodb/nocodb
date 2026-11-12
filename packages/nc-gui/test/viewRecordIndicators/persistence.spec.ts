import { describe, expect, it, vi } from 'vitest'
import type { ViewType } from 'nocodb-sdk'
import { persistViewRecordIndicators } from 'nocodb:viewRecordIndicatorPersistence'
import { readViewRecordIndicators } from 'nocodb:viewRecordIndicators'

const enabled = { showCount: true, boldNonEmpty: true, refreshAmount: 3, refreshUnit: 'hours' as const }

function savedView(overrides: Partial<ViewType>): ViewType {
  return { id: 'view-1', fk_model_id: 'table-1', show: true, title: 'Needs review', type: 3, ...overrides }
}

describe('saved-view record-indicator persistence', () => {
  it('does not add a settings request for a normally created default view', async () => {
    const view = savedView({ id: 'created-view', meta: { icon: 'check', other: { keep: true } } })
    const update = vi.fn()
    expect(await persistViewRecordIndicators(view, readViewRecordIndicators(undefined), update)).toBe(view)
    expect(update).not.toHaveBeenCalled()
  })

  it('updates the selected view and preserves string metadata, icons and unknown preference fields', async () => {
    const meta = { icon: 'bell', unrelated: { color: 'blue' }, sidebarIndicators: { futureOption: 'keep' } }
    const view = savedView({ id: 'target-view', meta: JSON.stringify(meta) })
    const original = view.meta
    const update = vi.fn(async (id: string, updates: Partial<ViewType>) => ({ ...view, ...updates, id }))
    const saved = await persistViewRecordIndicators(view, enabled, update)

    expect(update).toHaveBeenCalledExactlyOnceWith('target-view', {
      meta: { ...meta, sidebarIndicators: { futureOption: 'keep', ...enabled } },
    })
    expect(saved.meta).toEqual({ ...meta, sidebarIndicators: { futureOption: 'keep', ...enabled } })
    expect(view.meta).toBe(original)
  })

  it('can explicitly disable indicators inherited by a newly copied view', async () => {
    const view = savedView({ id: 'copied-view', meta: { icon: 'copy', sidebarIndicators: enabled } })
    const defaults = readViewRecordIndicators(undefined)
    const update = vi.fn(async (id: string, updates: Partial<ViewType>) => ({ ...view, ...updates, id }))

    const saved = await persistViewRecordIndicators(view, defaults, update)
    expect(update).toHaveBeenCalledOnce()
    expect(readViewRecordIndicators(saved.meta)).toEqual(defaults)
    expect((saved.meta as Record<string, unknown>).icon).toBe('copy')
  })

  it('leaves a successfully created view intact when the later settings request fails', async () => {
    const created = savedView({ id: 'created-view', title: 'Needs review', meta: { icon: 'bell' } })
    const original = structuredClone(created)
    const update = vi.fn().mockRejectedValue(new Error('update rejected'))

    await expect(persistViewRecordIndicators(created, enabled, update)).rejects.toThrow('update rejected')
    expect(created).toEqual(original)
    expect(update).toHaveBeenCalledExactlyOnceWith('created-view', expect.any(Object))
  })

  it.each([null, { id: 'a-different-view', meta: {} }])(
    'does not report a missing or mismatched update as success',
    async (reply) => {
      const created = savedView({ id: 'created-view', meta: { icon: 'bell' } })
      const update = vi.fn().mockResolvedValue(reply)
      await expect(persistViewRecordIndicators(created, enabled, update)).rejects.toThrow('could not be saved')
      expect(created.meta).toEqual({ icon: 'bell' })
    },
  )

  it('rejects an invalid interval before making a metadata request', async () => {
    const update = vi.fn()
    await expect(
      persistViewRecordIndicators(savedView({ id: 'view-1' }), { ...enabled, refreshAmount: 0 }, update),
    ).rejects.toThrow('Invalid record indicator refresh interval')
    expect(update).not.toHaveBeenCalled()
  })
})
