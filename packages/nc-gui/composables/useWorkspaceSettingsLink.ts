/**
 * Opens workspace settings from anywhere.
 *
 * The shell is an overlay keyed off `?wsSettings=`, so inside the workspace the
 * way to open it is to add the param to the current route — the page underneath
 * stays mounted and closing lands back on it. From outside the workspace (the
 * account pages, another workspace) it navigates to the workspace home first.
 */
export function useWorkspaceSettingsLink() {
  const router = useRouter()

  const route = router.currentRoute

  return function openWorkspaceSettings(
    slug: WsSettingsSlug,
    { workspaceId, query, newTab }: { workspaceId?: string; query?: Record<string, string>; newTab?: boolean } = {},
  ) {
    // Read lazily: the workspace store itself calls this helper during setup.
    const targetWsId = workspaceId ?? useWorkspace().activeWorkspaceId

    const isInWorkspace =
      (route.value.name as string | undefined)?.startsWith('index-typeOrId') &&
      !!route.value.params.typeOrId &&
      !['base', 'ERD'].includes(route.value.params.typeOrId as string)

    const isSameWorkspace = isInWorkspace && (!workspaceId || workspaceId === route.value.params.typeOrId)

    if (isSameWorkspace && !newTab) {
      return navigateTo({ query: { ...route.value.query, ...query, wsSettings: slug } })
    }

    if (!targetWsId) return

    const target = { path: `/${targetWsId}`, query: { ...query, wsSettings: slug } }

    if (newTab) {
      return navigateTo(router.resolve(target).href, { open: navigateToBlankTargetOpenOption })
    }

    return navigateTo(target)
  }
}
