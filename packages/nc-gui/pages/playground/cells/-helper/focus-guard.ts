/** Grid editors focus themselves on mount and on every re-render (the grid only ever mounts one);
 * with a column of them live, only the grid cell the user last pressed in may take focus. */

const GRID_CELL = '.pg-grid-cell'

let nativeFocus: HTMLElement['focus'] | null = null

let activeCell: Element | null = null

function onPointerDown(e: PointerEvent) {
  activeCell = e.target instanceof Element ? e.target.closest(GRID_CELL) : null
}

export function installCellsFocusGuard() {
  if (nativeFocus) return
  const focus = HTMLElement.prototype.focus
  nativeFocus = focus
  HTMLElement.prototype.focus = function (options?: FocusOptions) {
    const cell = this.closest(GRID_CELL)
    if (cell && cell !== activeCell) return
    focus.call(this, options)
  }
  document.addEventListener('pointerdown', onPointerDown, true)
}

export function uninstallCellsFocusGuard() {
  if (!nativeFocus) return
  HTMLElement.prototype.focus = nativeFocus
  nativeFocus = null
  activeCell = null
  document.removeEventListener('pointerdown', onPointerDown, true)
}
