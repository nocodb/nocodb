import { Dropdown as AntDropdown, Menu as AntMenu, Modal as AntModal, Select as AntSelect, message } from 'ant-design-vue/es'

// Ant's default `slide-up` enter starts at opacity 0 and runs 0.2s — most of the
// perceived click-to-open delay on menus and selects. An empty name means no
// motion at all (`getMotion` treats it as falsy); ant itself ships
// `choiceTransitionName` this way. Set as a prop default so any call site can
// still pass its own, and so new call sites get it for free.
// Modals keep their animation — they are a deliberate context switch.
AntDropdown.props.transitionName = { type: String, default: '' }
AntSelect.props.transitionName = { type: String, default: '' }

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component(AntMenu.name, AntMenu)
  nuxtApp.vueApp.component(AntModal.name, AntModal)

  message.success = ncMessage.success
  message.error = ncMessage.error
  message.info = ncMessage.info
  message.warning = ncMessage.warn
  message.warn = ncMessage.warning
  message.toast = ncMessage.toast

  message.config({
    duration: ANT_MESSAGE_DURATION,
    maxCount: ANT_MESSAGE_MAX_COUNT,
  })
})
