export default defineNuxtPlugin(function (nuxtApp) {
  const smartsheetStoreEventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.SmartsheetStore)
  nuxtApp.provide('eventBus', {
    smartsheetStoreEventBus,
  })
})
