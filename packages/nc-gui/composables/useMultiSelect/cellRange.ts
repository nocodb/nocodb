export interface Cell {
  row: number
  col: number
}

export class CellRange {
  _start: Cell | null
  _end: Cell | null
  _oldStart: Cell | null
  _oldEnd: Cell | null

  constructor(start = null, end = null) {
    this._start = start
    this._end = end ?? this._start
    this._oldStart = start
    this._oldEnd = end ?? this._start
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

  isDifferentColSelection() {
    if (this.isEmpty() || this.isSingleCell()) return false

    return this.oldStart.col !== this.start.col || this.oldEnd.col !== this.end.col
  }

  get start(): Cell {
    return {
      row: Math.min(this._start?.row ?? NaN, this._end?.row ?? NaN),
      col: Math.min(this._start?.col ?? NaN, this._end?.col ?? NaN),
    }
  }

  get oldStart(): Cell {
    return {
      row: Math.min(this._oldStart?.row ?? NaN, this._oldEnd?.row ?? NaN),
      col: Math.min(this._oldStart?.col ?? NaN, this._oldEnd?.col ?? NaN),
    }
  }

  get end(): Cell {
    return {
      row: Math.max(this._start?.row ?? NaN, this._end?.row ?? NaN),
      col: Math.max(this._start?.col ?? NaN, this._end?.col ?? NaN),
    }
  }

  get oldEnd(): Cell {
    return {
      row: Math.max(this._oldStart?.row ?? NaN, this._oldEnd?.row ?? NaN),
      col: Math.max(this._oldStart?.col ?? NaN, this._oldEnd?.col ?? NaN),
    }
  }

  startRange(value: Cell) {
    this._start = value
    this._end = value
    this._oldStart = value
    this._oldEnd = value
  }

  endRange(value: Cell) {
    this._oldEnd = this._end
    this._end = value
  }

  clear() {
    this._oldStart = this._start
    this._oldEnd = this._end
    this._start = null
    this._end = null
  }
}
