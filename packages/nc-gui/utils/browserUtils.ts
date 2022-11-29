// refer - https://stackoverflow.com/a/11752084
export const isMac = () => /Mac/i.test(navigator.platform)
export const isDrawerOrModalExist = () => document.querySelector('.ant-modal.active, .ant-drawer.active')
