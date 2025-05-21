import type { Row } from '../../../../../lib/types'

export enum ElementTypes {
  ROW = 'ROW',
  GROUP = 'GROUP',
  ADD_NEW_ROW = 'ADD_NEW_ROW',
  EDIT_NEW_ROW_METHOD = 'EDIT_NEW_ROW_METHOD',
}

interface BaseElement {
  x: number
  y: number
  height: number
  width?: number
  type: ElementTypes
  level?: number
}

interface RowElement extends BaseElement {
  row?: Row
  type: ElementTypes.ROW | ElementTypes.ADD_NEW_ROW | ElementTypes.EDIT_NEW_ROW_METHOD
}

interface GroupElement extends BaseElement {
  group: CanvasGroup
  type: ElementTypes.GROUP
}

type Element = RowElement | GroupElement

// Todo: refactor and clean up this class
// Class representing a single canvas element with utility methods
export class CanvasElementItem implements RowElement, GroupElement {
  x: number
  y: number
  height: number
  width?: number
  type: ElementTypes
  row?: Row
  group?: CanvasGroup
  level?: number

  _groupPath?: number[]
  _rowIndex?: number

  constructor({ groupPath, rowIndex, ...element }: any) {
    // Element) {
    // this.x = element.x
    // this.y = element.y
    // this.height = element.height
    // this.level = element.level
    // this.type = element.type
    // this.row = (element as RowElement).row
    // this.group = (element as GroupElement).group

    Object.assign(this, element)
    // Todo: remove this hack after refactoring
    this._groupPath = groupPath
    this._rowIndex = rowIndex
  }

  // Checks if the element is a group
  get isGroup() {
    return this.type === ElementTypes.GROUP
  }

  // Checks if the element is a row
  get isRow() {
    return this.type === ElementTypes.ROW
  }

  // Checks if the element is an "add new row"
  get isAddNewRow() {
    return this.type === ElementTypes.ADD_NEW_ROW
  }

  // Gets the row index or returns -1 if not available
  get rowIndex() {
    return this._rowIndex ?? this.row?.rowMeta?.rowIndex
  }

  // Get the group or return null if not available
  get groupPath() {
    return this._groupPath ?? this.row?.rowMeta?.path ?? []
  }
}

// CanvasElement class is used to manage elements on the canvas
// and find elements at a given point
export class CanvasElement {
  public elements: Array<Element>

  constructor(elements: Array<Element> = []) {
    this.elements = elements
  }

  findElementAt(x: number, y: number, type?: ElementTypes | ElementTypes[]): CanvasElementItem | null {
    const candidates = this.elements
      .filter((el) => {
        const withinVertical = y >= el.y && y <= el.y + el.height

        const typeMatches = !type || (Array.isArray(type) ? type.includes(el.type) : el.type === type)

        return withinVertical && typeMatches
      })
      .sort((a, b) => (b.level || 0) - (a.level || 0))

    return candidates[0] ? new CanvasElementItem(candidates[0]) : null
  }

  findElementAtWithX(x: number, y: number, type?: ElementTypes): CanvasElementItem | null {
    const candidates = this.elements
      .filter((el) => {
        // Check vertical bounds
        const withinVertical = y >= el.y && y <= el.y + el.height

        const withinHorizontal = el.width !== undefined && el.width !== null ? x >= el.x && x <= el.x + el.width : true

        const typeMatches = !type || el.type === type

        return withinVertical && withinHorizontal && typeMatches
      })
      .sort((a, b) => (b.level || 0) - (a.level || 0))

    return candidates[0] ? new CanvasElementItem(candidates[0]) : null
  }

  addElement(element: Element) {
    this.elements.push(element)
  }

  clear() {
    this.elements = []
  }
}
