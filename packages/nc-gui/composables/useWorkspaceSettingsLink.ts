/** Opens the workspace settings page on a pane, from anywhere. */
export function useWorkspaceSettingsLink() {
  const router = useRouter()

  const route = router.currentRoute

  return function openWorkspaceSettings(
    slug: WsSettingsSlug,
    { workspaceId, query, newTab }: { workspaceId?: string; query?: Record<string, string>; newTab?: boolean } = {},
  ) {
    // Read lazily: the workspace store itself calls this helper during setup.
    const targetWsId = workspaceId ?? useWorkspace().activeWorkspaceId

    if (!targetWsId) return

    const target = { path: wsSettingsPath(targetWsId, slug), query }

    // Back on the settings page returns here; moving between panes keeps the first origin.
    if (!newTab && !wsSettingsSlugFromRoute(route.value)) ncWsSettingsBackRoute().set(route.value.fullPath)

    if (newTab) {
      return navigateTo(router.resolve(target).href, { open: navigateToBlankTargetOpenOption })
    }

    return navigateTo(target)
  }
}
