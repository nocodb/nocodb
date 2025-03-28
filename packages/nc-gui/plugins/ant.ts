import { Menu as AntMenu, Modal as AntModal, message } from 'ant-design-vue'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component(AntMenu.name, AntMenu)
  nuxtApp.vueApp.component(AntModal.name, AntModal)
  message.config({
    duration: ANT_MESSAGE_DURATION,
  })
})
