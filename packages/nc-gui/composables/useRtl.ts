import { createSharedComposable } from '@vueuse/core'

export const useRtl = createSharedComposable(() => {
  const { locale } = useI18n()

  const isRtl = computed(() => isRtlLang(locale.value as keyof typeof Language))

  return { isRtl }
})
