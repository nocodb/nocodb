// refer - https://stackoverflow.com/a/11752084
export const isMac = () => /Mac/i.test(navigator.platform)
export const isDrawerExist = () => document.querySelector('.ant-drawer-open')
export const isLinkDropdownExist = () => document.querySelector('.nc-links-dropdown.active')
export const isDrawerOrModalExist = () => document.querySelector('.ant-modal.active, .ant-drawer-open')
export const isExpandedFormOpenExist = () => document.querySelector('.nc-drawer-expanded-form.active')
export const isExpandedCellInputExist = () => document.querySelector('.expanded-cell-input')
export const cmdKActive = () => document.querySelector('.cmdk-modal-active')
export const isActiveInputElementExist = () => {
  return (
    document.activeElement?.tagName === 'INPUT' ||
    document.activeElement?.tagName === 'TEXTAREA' ||
    // A rich text editor is a div with the contenteditable attribute set to true.
    !!document.activeElement?.getAttribute('contenteditable')
  )
}

export const isNcDropdownOpen = () => document.querySelector('.nc-dropdown.active')
export const isDropdownActive = () => document.querySelector('.nc-dropdown')

export const isFieldEditOrAddDropdownOpen = () => document.querySelector('.nc-dropdown-edit-column.active')
export const getScrollbarWidth = () => {
  const outer = document.createElement('div')
  outer.style.visibility = 'hidden'
  outer.style.width = '100px'
  document.body.appendChild(outer)

  const widthNoScroll = outer.offsetWidth
  outer.style.overflow = 'scroll'

  const inner = document.createElement('div')
  inner.style.width = '100%'
  outer.appendChild(inner)

  const widthWithScroll = inner.offsetWidth
  outer?.parentNode?.removeChild(outer)
  return widthNoScroll - widthWithScroll
}

export function getElementAtMouse<T>(cssSelector: string, { clientX, clientY }: { clientX: number; clientY: number }) {
  return document.elementsFromPoint(clientX, clientY).find((el) => el.matches(cssSelector)) as T | undefined
}

export function forcedNextTick(cb: () => void) {
  // See https://github.com/vuejs/vue/issues/9200
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cb()
    })
  })
}
