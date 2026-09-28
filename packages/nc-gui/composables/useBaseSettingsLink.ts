/**
 * Opens base settings from anywhere.
 *
 * The shell is an overlay keyed off `?settings=`, so for the base you are already
 * in, the way to open it is to add the param to the current route — the table or
 * view underneath then stays mounted and closing lands you back on it. Another
 * base has to be navigated to; its `/settings/{slug}` page redirects straight
 * back into this same overlay.
 */
export function useBaseSettingsLink() {
  const route = useRouter().currentRoute

  return function openBaseSettings(
    tabOrSlug: string,
    { baseId, query }: { baseId?: string; query?: Record<string, string> } = {},
  ) {
    const slug = baseSettingsTabToSlug[tabOrSlug] || tabOrSlug

    const currentBaseId = route.value.params.baseId as string | undefined

    const targetBaseId = baseId ?? currentBaseId

    if (!targetBaseId) return

    if (targetBaseId !== currentBaseId) {
      return navigateTo({
        path: `/${route.value.params.typeOrId ?? 'nc'}/${targetBaseId}/settings/${slug}`,
        query,
      })
    }

    return navigateTo({ query: { ...route.value.query, ...query, settings: slug } })
  }
}
