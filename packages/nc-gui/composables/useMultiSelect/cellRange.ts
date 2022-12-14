export interface Cell {
  row: number | null
  col: number | null
}

export class CellRange {
  _start: Cell
  _end: Cell

  constructor(start = null, end = null) {
    this._start = start ?? { row: null, col: null }
    this._end = end ?? this._start
  }

  isEmpty() {
    return this._start.col == null || this._start.row == null || this._end.col == null || this._end.row == null
  }

  isSingleCell() {
    return !this.isEmpty() && this._start?.col === this._end?.col && this._start?.row === this._end?.row
  }

  get start(): Cell {
    if (this.isEmpty()) {
      return { row: null, col: null }
    }
    return {
      row: Math.min(this._start.row!, this._end.row!),
      col: Math.min(this._start.col!, this._end.col!),
    }
  }

  get end(): Cell {
    if (this.isEmpty()) {
      return { row: null, col: null }
    }
    return {
      row: Math.max(this._start.row!, this._end.row!),
      col: Math.max(this._start.col!, this._end.col!),
    }
  }

  startRange(value: Cell) {
    this._start = value
    this._end = value
  }

  endRange(value: Cell) {
    this._end = value
  }

  clear() {
    this._start = { row: null, col: null }
    this._end = { row: null, col: null }
  }
}
