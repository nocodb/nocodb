// refer - https://stackoverflow.com/a/11752084
export const isMac = () => /Mac/i.test(navigator.platform)
// .ant-drawer will be destroyed when closed. no active class is required.
export const isDrawerOrModalExist = () => document.querySelector('.ant-modal.active, .ant-drawer')
