import { cardHeightForFieldCount, computeColumnPackedLayout } from '~/components/smartsheet/calendar/calendarRecordCardHeight'

describe('cardHeightForFieldCount', () => {
  it('shows at least one line', () => {
    expect(cardHeightForFieldCount(0)).toBe(30)
    expect(cardHeightForFieldCount(-3)).toBe(30)
    expect(cardHeightForFieldCount(1)).toBe(30)
  })

  it('grows per field', () => {
    expect(cardHeightForFieldCount(2)).toBe(52)
    expect(cardHeightForFieldCount(3)).toBe(74)
    expect(cardHeightForFieldCount(5)).toBe(118)
  })

  it('caps at the max field count (5)', () => {
    expect(cardHeightForFieldCount(6)).toBe(118)
    expect(cardHeightForFieldCount(20)).toBe(118)
  })
})

describe('computeColumnPackedLayout', () => {
  it('packs a single column tightly using each card natural height', () => {
    // one column, three cards of differing heights, stacked in order
    const tops = computeColumnPackedLayout([
      { startCol: 0, spanCols: 1, rowIndex: 0, height: 68 },
      { startCol: 0, spanCols: 1, rowIndex: 1, height: 28 },
      { startCol: 0, spanCols: 1, rowIndex: 2, height: 48 },
    ])
    // gap=8: 8, then 8+68+8=84, then 84+28+8=120
    expect(tops).toEqual([8, 84, 120])
  })

  it('keeps columns independent so heights in one do not inflate another', () => {
    // col 0 has a tall card; col 1 a short one — col 1 stays compact
    const tops = computeColumnPackedLayout([
      { startCol: 0, spanCols: 1, rowIndex: 0, height: 68 }, // col 0
      { startCol: 1, spanCols: 1, rowIndex: 0, height: 28 }, // col 1
      { startCol: 1, spanCols: 1, rowIndex: 1, height: 28 }, // col 1 second card
    ])
    expect(tops[0]).toBe(8) // col 0 first
    expect(tops[1]).toBe(8) // col 1 first — NOT pushed down by col 0
    expect(tops[2]).toBe(44) // col 1 second: 8+28+8
  })

  it('places a multi-day bar below everything in every column it spans, aligned', () => {
    // col 0 has a tall row-0 card (68), col 1 a short one (28);
    // a span across col 0+1 at row 1 must clear the taller column.
    const tops = computeColumnPackedLayout([
      { startCol: 0, spanCols: 1, rowIndex: 0, height: 68 }, // col 0 row 0
      { startCol: 1, spanCols: 1, rowIndex: 0, height: 28 }, // col 1 row 0
      { startCol: 0, spanCols: 2, rowIndex: 1, height: 28 }, // span col 0-1 row 1
    ])
    expect(tops[0]).toBe(8)
    expect(tops[1]).toBe(8)
    // span clears max(col0Bottom=8+68+8=84, col1Bottom=8+28+8=44) = 84
    expect(tops[2]).toBe(84)
  })

  it('pushes later cards in a spanned column below the bar (no overlap)', () => {
    const tops = computeColumnPackedLayout([
      { startCol: 0, spanCols: 2, rowIndex: 0, height: 48 }, // span col 0-1 row 0
      { startCol: 1, spanCols: 1, rowIndex: 1, height: 28 }, // col 1 below the span
    ])
    expect(tops[0]).toBe(8)
    // col1 next card starts after span bottom: 8+48+8 = 64
    expect(tops[1]).toBe(64)
  })
})
