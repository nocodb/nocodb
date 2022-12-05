import { Menu as AntMenu, Modal as AntModal, message } from 'ant-design-vue'
// import VueBarcode from '@chenfengyuan/vue-barcode'
import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  // nuxtApp.vueApp.component(VueBarcode.name, VueBarcode)
  nuxtApp.vueApp.component(AntMenu.name, AntMenu)
  nuxtApp.vueApp.component(AntModal.name, AntModal)
  message.config({
    duration: +(process.env.ANT_MESSAGE_DURATION ?? 3),
  })
})
