export interface Cell {
  row: number
  col: number
}

export class CellRange {
  _start: Cell | null
  _end: Cell | null

  constructor(start = null, end = null) {
    this._start = start
    this._end = end ?? this._start
  }

  isEmpty() {
    return this._start == null || this._end == null
  }

  isSingleCell() {
    return !this.isEmpty() && this._start?.col === this._end?.col && this._start?.row === this._end?.row
  }

  isSingleRow() {
    return !this.isEmpty() && this._start?.row === this._end?.row
  }

  isCellInRange(cell: Cell) {
    return (
      !this.isEmpty() &&
      cell.row >= this.start.row &&
      cell.row <= this.end.row &&
      cell.col >= this.start.col &&
      cell.col <= this.end.col
    )
  }

  isRowInRange(row: number) {
    return !this.isEmpty() && row >= this.start.row && row <= this.end.row
  }

  isColInRange(col: number) {
    return !this.isEmpty() && col >= this.start.col && col <= this.end.col
  }

  get start(): Cell {
    return {
      row: Math.min(this._start?.row ?? NaN, this._end?.row ?? NaN),
      col: Math.min(this._start?.col ?? NaN, this._end?.col ?? NaN),
    }
  }

  get end(): Cell {
    return {
      row: Math.max(this._start?.row ?? NaN, this._end?.row ?? NaN),
      col: Math.max(this._start?.col ?? NaN, this._end?.col ?? NaN),
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
    this._start = null
    this._end = null
  }
}
