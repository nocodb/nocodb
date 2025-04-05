export enum ElementTypes {
  ROW = 'ROW',
  GROUP = 'GROUP',
  ADD_NEW_ROW = 'ADD_NEW_ROW',
}

interface BaseElement {
  x: number
  y: number
  height: number
  level: number
  type: ElementTypes
}

interface RowElement extends BaseElement {
  row?: Row
  type: ElementTypes.ROW | ElementTypes.ADD_NEW_ROW
}

interface GroupElement extends BaseElement {
  group: CanvasGroup
  type: ElementTypes.GROUP
}

type Element = RowElement | GroupElement

export class CanvasElement {
  private elements: Array<Element>
  constructor(elements: Array<Element> = []) {
    this.elements = elements
  }

  findElementAt(x: number, y: number) {
    const candidates = this.elements
      .filter((el) => {
        // Only check if point is within vertical bounds
        return y >= el.y && y <= el.y + el.height
        // No horizontal bounds check since width is not defined
      })
      .sort((a, b) => (b.level || 0) - (a.level || 0))

    return candidates[0] || null
  }

  addElement(element: Element) {
    this.elements.push(element)
  }

  clear() {
    this.elements = []
  }
}
