import type { MaybeRef } from '@vueuse/core'
import { unref } from '@vue/reactivity'
import { useNuxtApp } from '#app'
import theme from '~/utils/colorsUtils'

export default function useColors(darkMode?: MaybeRef<boolean>) {
  let mode = $ref(unref(darkMode))
  const { $state } = useNuxtApp()

  if (!mode) mode = $state.value.darkMode

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

  const colors = computed(() => (mode ? theme.dark : theme.light))

  return { colors, getColorByIndex: (i: number) => colors.value[i % colors.value.length] }
}
