export interface Cell {
  row: number | null
  col: number | null
}

export class CellRange {
  _start: Cell | null
  _end: Cell | null

  constructor(start = null, end = null) {
    this._start = start
    this._end = end ?? this._start
  }

  get start() {
    return {
      row: Math.min(this._start?.row ?? NaN, this._end?.row ?? NaN),
      col: Math.min(this._start?.col ?? NaN, this._end?.col ?? NaN),
    }
  }

  get end() {
    return {
      row: Math.max(this._start?.row ?? NaN, this._end?.row ?? NaN),
      col: Math.max(this._start?.col ?? NaN, this._end?.col ?? NaN),
    }
  }

  startRange(value: Cell) {
    if (value == null) {
      return
    }

    this._start = value
    this._end = value
  }

  endRange(value: Cell) {
    if (value == null) {
      return
    }

    this._end = value
  }

  clear() {
    this._start = null
    this._end = null
  }

  isEmpty() {
    return this._start == null || this._end == null
  }
}
