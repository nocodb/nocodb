export const useBackToBase = () => {
  const router = useRouter()
  const route = router.currentRoute

  const { navigateToProject } = useGlobal()
  const { basesList } = storeToRefs(useBases())
  const { activeWorkspaceId } = storeToRefs(useWorkspace())
  const { isMobileMode } = useGlobal()

  // hideMiniSidebar is true on full-screen flows (payment, checkout, pricing, upgrade)
  // — we don't want back-to-base intruding on those pages
  const { hideMiniSidebar, isBaseSettingsFullPage } = storeToRefs(useSidebarStore())

  const isOnBasePage = computed(() => route.value.name?.toString().startsWith('index-typeOrId-baseId-') ?? false)

  const lastVisitedBase = computed(() => {
    const lastId = ncLastVisitedBase().get()
    return lastId ? basesList.value?.find((b) => b.id === lastId) ?? basesList.value?.[0] : basesList.value?.[0]
  })

  const shouldShow = computed(() => {
    // Show on base settings full-page mode (even though technically on a base page)
    if (isBaseSettingsFullPage.value) return !!lastVisitedBase.value

    return !isOnBasePage.value && !hideMiniSidebar.value && !!lastVisitedBase.value
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
