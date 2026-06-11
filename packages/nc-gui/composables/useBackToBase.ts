export const useBackToBase = ({ useFallback = true }: { useFallback?: boolean } = {}) => {
  const router = useRouter()
  const route = router.currentRoute

  const { navigateToProject } = useGlobal()
  const { basesList } = storeToRefs(useBases())
  const { activeWorkspaceId } = storeToRefs(useWorkspace())
  const { isMobileMode } = useGlobal()

  // — we don't want back-to-base intruding on those pages
  const { isBaseSettingsFullPage } = storeToRefs(useSidebarStore())

  const isOnBasePage = computed(() => route.value.name?.toString().startsWith('index-typeOrId-baseId-') ?? false)

  const lastVisitedBase = computed(() => {
    const lastId = ncLastVisitedBase().get()
    if (useFallback) {
      return lastId ? basesList.value?.find((b) => b.id === lastId) ?? basesList.value?.[0] : basesList.value?.[0]
    }

    return lastId ? basesList.value?.find((b) => b.id === lastId) : undefined
  })

  const shouldShow = computed(() => {
    // Show on base settings full-page mode (even though technically on a base page)
    if (isBaseSettingsFullPage.value) return !!lastVisitedBase.value

    return !isOnBasePage.value && !!lastVisitedBase.value
  })

  const navigateToBase = () => {
    if (!lastVisitedBase.value) return

    // Clear full-page mode before navigating back
    if (isBaseSettingsFullPage.value) {
      isBaseSettingsFullPage.value = false
    }

    navigateToProject({
      workspaceId: isEeUI ? activeWorkspaceId.value : undefined,
      baseId: lastVisitedBase.value.id,
    })
  }

  return {
    isOnBasePage,
    lastVisitedBase,
    shouldShow,
    navigateToBase,
    isMobileMode,
  }
}
