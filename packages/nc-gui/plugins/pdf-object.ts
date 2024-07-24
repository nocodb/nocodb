import PDFObjectPlugin from 'pdfobject-vue'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(PDFObjectPlugin)
})
