interface Element {
  path: Array<GroupNestedIn>
  level?: number
  rowIndex?: number
  groupIndex?: number
  x: number
  y: number
  height: number
  group?: CanvasGroup
  row?: Row
  type?: 'ADD_NEW_ROW'
}

export class CanvasElement {
  private elements: Array<Element> = []
  constructor(elements: Array<Element>) {
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
