// Created outside any effect scope: in the plugin, every on() would push an unsubscribe closure into the
// app-root scope that off() never removes, keeping each unmounted listener's component alive
const smartsheetStoreEventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.SmartsheetStore)
const realtimeBaseUserEventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.RealtimeBaseUser)
const realtimeViewMetaEventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.RealtimeViewMeta)

export default defineNuxtPlugin(function (nuxtApp) {
  nuxtApp.provide('eventBus', {
    smartsheetStoreEventBus,
    realtimeBaseUserEventBus,
    realtimeViewMetaEventBus,
  })
})
