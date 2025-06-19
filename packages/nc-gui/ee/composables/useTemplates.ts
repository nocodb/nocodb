export const useTemplates = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const templates = ref([])
  const isLoading = ref(false)
  const hasMore = ref(true)
  const page = ref(1)
  const perPage = ref(12)

  const query = reactive<{
    search: string
    industry: string | null
    usecase: string | null
  }>({
    search: '',
    industry: null,
    usecase: null,
  })

  const loadTemplates = async ({ reset = false }: { reset?: boolean } = {}) => {
    if (!activeWorkspaceId.value) return

    if (reset) {
      templates.value = []
      page.value = 1
      hasMore.value = true
    }

    if (!hasMore.value || isLoading.value) return

    try {
      isLoading.value = true

      const res = await $api.internal.getOperation(activeWorkspaceId.value, NO_SCOPE, {
        operation: 'templates',
        page: page.value,
        per_page: perPage.value,
        ...query,
      })

      if (reset) {
        templates.value = res.list || []
      } else {
        templates.value = [...templates.value, ...(res.list || [])]
      }

      hasMore.value = (res.list || []).length === perPage.value

      if (hasMore.value) {
        page.value++
      }
    } catch (e) {
      console.error('Failed to load templates:', e)
    } finally {
      isLoading.value = false
    }
  }

  watch(
    () => ({ ...query }),
    () => {
      loadTemplates({ reset: true })
    },
    { deep: true },
  )

  return {
    templates,
    query,
    loadTemplates,
    isLoading,
    hasMore,
  }
})
