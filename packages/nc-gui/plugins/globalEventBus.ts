import type { GlobalEvents } from '#imports'
import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  const eventBus: UseEventBusReturn<GlobalEvents, any> = useEventBus<GlobalEvents>(Symbol('GlobalEventBus'))
  nuxtApp.provide('globalEventBus', eventBus)
})
