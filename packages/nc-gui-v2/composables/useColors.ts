import type { MaybeRef } from '@vueuse/core'
import { unref } from '@vue/reactivity'
import { tryOnScopeDispose } from '#build/imports'
import { useNuxtApp } from '#app'
import theme from '~/utils/colorsUtils'

export default function useColors(darkMode?: MaybeRef<boolean>) {
  const scope = effectScope()

  let mode = $ref(unref(darkMode))
  const { $state } = useNuxtApp()

  if (!mode) mode = $state.value.darkMode

  scope.run(() => {
    watch(
      () => $state.value.darkMode,
      (newMode) => {
        mode = newMode
      },
    )

    watchEffect(() => {
      const newMode = unref(darkMode)
      if (newMode) mode = newMode
    })
  })

  tryOnScopeDispose(() => scope.stop())

  const colors = computed(() => (mode ? theme.dark : theme.light))

  return { colors, getColorByIndex: (i: number) => colors.value[i % colors.value.length] }
}
