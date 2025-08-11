export default defineNuxtPlugin(function (nuxtApp) {
  const smartsheetStoreEventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.SmartsheetStore)
  const realtimeEventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.Realtime)
  nuxtApp.provide('eventBus', {
    smartsheetStoreEventBus,
    realtimeEventBus,
  })
})
