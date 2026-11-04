import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIEW_RECORD_INDICATORS,
  areViewRecordIndicatorsEqual,
  isValidViewRecordIndicatorSettings,
  mergeViewRecordIndicators,
  readViewRecordIndicators,
} from 'nocodb:viewRecordIndicators'

const enabled = { showCount: true, boldNonEmpty: false, refreshAmount: 2, refreshUnit: 'hours' as const }

describe('saved-view indicator metadata', () => {
  it.each([undefined, null, [], false, '', 'bad json', 'null', '[]', { sidebarIndicators: [] }])(
    'keeps malformed containers off: %j',
    (meta) => {
      expect(readViewRecordIndicators(meta)).toEqual(DEFAULT_VIEW_RECORD_INDICATORS)
    },
  )

  it('reads JSON metadata and strict independent opt-ins', () => {
    expect(readViewRecordIndicators(JSON.stringify({ sidebarIndicators: enabled }))).toEqual(enabled)
    expect(readViewRecordIndicators({ sidebarIndicators: { showCount: 'true', boldNonEmpty: true } })).toEqual({
      ...DEFAULT_VIEW_RECORD_INDICATORS,
      boldNonEmpty: true,
    })
  })

  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, '2'])('rejects unsafe interval amount %j', (refreshAmount) => {
    expect(isValidViewRecordIndicatorSettings({ ...enabled, refreshAmount })).toBe(false)
    expect(readViewRecordIndicators({ sidebarIndicators: { ...enabled, refreshAmount } })).toEqual({
      ...enabled,
      refreshAmount: 1,
    })
  })

  it('validates units and safely normalizes an invalid unit', () => {
    expect(isValidViewRecordIndicatorSettings({ ...enabled, refreshUnit: 'minutes' })).toBe(false)
    expect(readViewRecordIndicators({ sidebarIndicators: { ...enabled, refreshUnit: 'minutes' } })).toEqual({
      ...enabled,
      refreshUnit: 'days',
    })
    expect(isValidViewRecordIndicatorSettings({ ...enabled, refreshAmount: 30, refreshUnit: 'days' })).toBe(true)
  })

  it('merges latest main and namespaced metadata without mutating either input', () => {
    const original = { icon: 'book', other: { retained: true }, sidebarIndicators: { extra: 'keep', showCount: false } }
    const merged = mergeViewRecordIndicators(JSON.stringify(original), enabled)
    expect(merged).toEqual({ ...original, sidebarIndicators: { extra: 'keep', ...enabled } })
    expect(original.sidebarIndicators).toEqual({ extra: 'keep', showCount: false })
    expect(merged.other).toEqual({ retained: true })
  })

  it('returns independent default objects and compares every preference', () => {
    const first = readViewRecordIndicators(null)
    first.showCount = true
    expect(readViewRecordIndicators(null)).toEqual(DEFAULT_VIEW_RECORD_INDICATORS)
    expect(areViewRecordIndicatorsEqual(enabled, { ...enabled })).toBe(true)
    for (const change of [{ showCount: false }, { boldNonEmpty: true }, { refreshAmount: 3 }, { refreshUnit: 'days' as const }]) {
      expect(areViewRecordIndicatorsEqual(enabled, { ...enabled, ...change })).toBe(false)
    }
  })
})
