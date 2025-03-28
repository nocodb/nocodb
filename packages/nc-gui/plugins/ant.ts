import { Menu as AntMenu, Modal as AntModal, message } from 'ant-design-vue/es'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component(AntMenu.name, AntMenu)
  nuxtApp.vueApp.component(AntModal.name, AntModal)

  message.success = ncMessage.success
  message.error = ncMessage.error
  message.info = ncMessage.info
  message.warning = ncMessage.warn
  message.warn = ncMessage.warning

  message.config({
    duration: ANT_MESSAGE_DURATION,
  })
})
