export default defineNuxtPlugin(function (nuxtApp) {
  const smartsheetStoreEventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.SmartsheetStore)
  const realtimeBaseUserEventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.RealtimeBaseUser)
  const realtimeViewMetaEventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.RealtimeViewMeta)
  nuxtApp.provide('eventBus', {
    smartsheetStoreEventBus,
    realtimeBaseUserEventBus,
    realtimeViewMetaEventBus,
  })
})
