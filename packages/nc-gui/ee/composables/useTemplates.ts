export const useTemplates = createSharedComposable(() => {
  const templates = ref<Record<string, any>>({})

  return {
    templates,
  }
})
