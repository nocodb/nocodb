import { interfaceCellContentBox } from '~/ee/components/smartsheet/list/composables/constants'
import { pxToRowHeight, rowHeightTruncateLines } from '~/utils/cell'

describe('interfaceCellContentBox', () => {
  it('centers a 32px content box inside the Short preset so the shared renderers centering engages', () => {
    expect(interfaceCellContentBox(100, 36)).toEqual({ y: 102, height: 32 })
  })

  it('is the identity for taller presets — grid-style top-anchored first line', () => {
    expect(interfaceCellContentBox(100, 48)).toEqual({ y: 100, height: 48 })
    expect(interfaceCellContentBox(100, 64)).toEqual({ y: 100, height: 64 })
    expect(interfaceCellContentBox(100, 86)).toEqual({ y: 100, height: 86 })
  })

  it('is the identity for non-preset heights (nested renders cannot double-shift)', () => {
    expect(interfaceCellContentBox(100, 32)).toEqual({ y: 100, height: 32 })
    expect(interfaceCellContentBox(100, 28)).toEqual({ y: 100, height: 28 })
  })
})

describe('rowHeightTruncateLines — interface list presets', () => {
  it('gives the taller interface presets grid-style line counts', () => {
    expect(rowHeightTruncateLines(48)).toBe(2)
    expect(rowHeightTruncateLines(64)).toBe(3)
    expect(rowHeightTruncateLines(86)).toBe(4)
  })

  it('caps select-chip rows to what fits the tighter scale', () => {
    expect(rowHeightTruncateLines(48, true)).toBe(1)
    expect(rowHeightTruncateLines(64, true)).toBe(2)
    expect(rowHeightTruncateLines(86, true)).toBe(3)
  })

  it('keeps Short single-line (renders through the 32px box) and the grid scale unchanged', () => {
    expect(rowHeightTruncateLines(32)).toBe(1)
    expect(rowHeightTruncateLines(36)).toBe(1)
    expect(rowHeightTruncateLines(60)).toBe(2)
    expect(rowHeightTruncateLines(90)).toBe(4)
    expect(rowHeightTruncateLines(120)).toBe(6)
    expect(rowHeightTruncateLines(90, true)).toBe(3)
    expect(rowHeightTruncateLines(120, true)).toBe(4)
  })
})

describe('pxToRowHeight — interface list presets', () => {
  it('maps the interface heights onto media item tiers that fit the row', () => {
    // Attachment item tiers: enum 1 → 24px, 2 → 32px, 4 → 64px (+8px padding);
    // 64 cannot fit the 64px tier, 86 fits one 64px row like the grid Tall
    expect(pxToRowHeight[36]).toBe(1)
    expect(pxToRowHeight[48]).toBe(2)
    expect(pxToRowHeight[64]).toBe(2)
    expect(pxToRowHeight[86]).toBe(4)
  })

  it('keeps the grid scale unchanged', () => {
    expect(pxToRowHeight[32]).toBe(1)
    expect(pxToRowHeight[60]).toBe(2)
    expect(pxToRowHeight[90]).toBe(4)
    expect(pxToRowHeight[120]).toBe(6)
  })
})
