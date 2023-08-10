import { ref } from 'vue'
import type { MaybeRef } from '@vueuse/core'
import { computed, effectScope, theme, tryOnScopeDispose, unref, useNuxtApp, watch, watchEffect } from '#imports'

export function useColors(darkMode?: MaybeRef<boolean>) {
  const scope = effectScope()

  const mode = ref(unref(darkMode))
  const { $state } = useNuxtApp()

  if (typeof mode.value === 'undefined') mode.value = $state.darkMode.value

  scope.run(() => {
    watch($state.darkMode, (newMode) => {
      if (typeof mode.value === 'undefined') mode.value = newMode
    })

    watchEffect(() => {
      const newMode = unref(darkMode)
      if (newMode) mode.value = newMode
    })
  })

  tryOnScopeDispose(() => scope.stop())

  const colors = computed(() => (mode.value ? theme.dark : theme.light))

  return { colors, getColorByIndex: (i: number) => colors.value[i % colors.value.length] }
}
