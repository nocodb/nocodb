// refer - https://stackoverflow.com/a/11752084
export const isMac = () => /Mac/i.test(navigator.platform)
export const isDrawerExist = () => document.querySelector('.ant-drawer-open')
export const isDrawerOrModalExist = () => document.querySelector('.ant-modal.active, .ant-drawer-open')
export const isExpandedCellInputExist = () => document.querySelector('.expanded-cell-input')
export const cmdKActive = () => document.querySelector('.cmdk-modal-active')
