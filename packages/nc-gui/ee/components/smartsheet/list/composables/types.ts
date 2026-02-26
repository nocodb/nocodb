/**
 * Hit-test element tracked during rendering.
 */
export interface ListCanvasElement {
  type: 'row' | 'chevron' | 'header' | 'addRow' | 'expandRow' | 'cell'
  rowIndex: number
  x: number
  y: number
  width: number
  height: number
  depth: number
  pk?: string | number
  columnId?: string
  parentPk?: string | number
}

export interface ListActiveCell {
  rowIndex: number
  depth: number
  column: CanvasGridColumn
  row: Record<string, any>
  x: number
  y: number
  width: number
  height: number
}
