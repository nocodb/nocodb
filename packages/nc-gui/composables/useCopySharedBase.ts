import { createSharedComposable, ref } from '#imports'

export const useCopySharedBase = createSharedComposable(() => {
  const sharedBaseId = ref<string | null>(null)

  return {
    sharedBaseId,
  }
})
