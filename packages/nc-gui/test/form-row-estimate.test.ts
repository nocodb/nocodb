import { UITypes } from 'nocodb-sdk'
import { estimateFieldHeightPx, estimateRowHeightPx } from '~/components/smartsheet/form/formRowEstimate'

describe('formRowEstimate', () => {
  it('compact fields use the base height', () => {
    expect(estimateFieldHeightPx({ uidt: UITypes.SingleLineText })).toBe(96)
    expect(estimateFieldHeightPx({ uidt: UITypes.Number })).toBe(96)
    // a select in dropdown mode (no meta.isList) is compact
    expect(estimateFieldHeightPx({ uidt: UITypes.SingleSelect })).toBe(96)
  })

  it('full-width fields are taller', () => {
    expect(estimateFieldHeightPx({ uidt: UITypes.LongText })).toBe(160)
    expect(estimateFieldHeightPx({ uidt: UITypes.Attachment })).toBe(160)
  })

  it('inline-list selects scale with option count and cap', () => {
    expect(
      estimateFieldHeightPx({ uidt: UITypes.SingleSelect, meta: { isList: true }, colOptions: { options: [] } }),
    ).toBe(84)
    expect(
      estimateFieldHeightPx({ uidt: UITypes.MultiSelect, meta: { isList: true }, colOptions: { options: new Array(3) } }),
    ).toBe(84 + 90) // 84 + 3*30
    expect(
      estimateFieldHeightPx({ uidt: UITypes.SingleSelect, meta: { isList: true }, colOptions: { options: new Array(50) } }),
    ).toBe(84 + 252) // capped
  })

  it('row height is the max of its member fields, with a floor', () => {
    expect(estimateRowHeightPx([{ uidt: UITypes.SingleLineText }, { uidt: UITypes.LongText }])).toBe(160)
    expect(estimateRowHeightPx([{ uidt: UITypes.SingleLineText }])).toBe(96)
    expect(estimateRowHeightPx([])).toBe(96)
  })
})
