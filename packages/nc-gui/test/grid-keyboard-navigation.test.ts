import { describe, expect, it } from 'vitest'
import { UITypes } from 'nocodb-sdk'
import { findNextNavigableCellPosition } from '../components/smartsheet/grid/canvas/utils/keyboardNavigation'

function createColumn(uidt: UITypes, overrides: Record<string, any> = {}) {
  return {
    id: `${uidt}-${Math.random()}`,
    readonly: false,
    isCellEditable: overrides.isCellEditable ?? true,
    isSyncedColumn: false,
    columnObj: {
      uidt,
      readonly: false,
      ...overrides.columnObj,
    },
    ...overrides,
  }
}

describe('findNextNavigableCellPosition', () => {
  it('skips non-editable columns and moves to the next editable one', () => {
    const columns = [
      createColumn(UITypes.AutoNumber),
      createColumn(UITypes.Rating, { isCellEditable: false }),
      createColumn(UITypes.SingleLineText),
      createColumn(UITypes.Checkbox),
    ]

    const nextCell = findNextNavigableCellPosition({
      row: 0,
      column: 1,
      columns,
      lastRow: 0,
      lastCol: columns.length - 1,
      isShiftKey: false,
    })

    expect(nextCell).toEqual({ row: 0, column: 2 })
  })

  it('moves backwards to the previous editable column when shift-tab is used', () => {
    const columns = [
      createColumn(UITypes.AutoNumber),
      createColumn(UITypes.SingleLineText),
      createColumn(UITypes.Rating, { isCellEditable: false }),
      createColumn(UITypes.SingleLineText),
    ]

    const nextCell = findNextNavigableCellPosition({
      row: 0,
      column: 3,
      columns,
      lastRow: 0,
      lastCol: columns.length - 1,
      isShiftKey: true,
    })

    expect(nextCell).toEqual({ row: 0, column: 1 })
  })
})
