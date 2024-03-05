// refer - https://stackoverflow.com/a/11752084
export const isMac = () => /Mac/i.test(navigator.platform)
export const isDrawerExist = () => document.querySelector('.ant-drawer-open')
export const isDrawerOrModalExist = () => document.querySelector('.ant-modal.active, .ant-drawer-open')
export const isExpandedCellInputExist = () => document.querySelector('.expanded-cell-input')
export const cmdKActive = () => document.querySelector('.cmdk-modal-active')

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
