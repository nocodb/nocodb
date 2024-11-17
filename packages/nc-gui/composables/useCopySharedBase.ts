export const useCopySharedBase = createSharedComposable(() => {
  const sharedBaseId = ref<string | null>(null)

  return {
    sharedBaseId,
  }
})
