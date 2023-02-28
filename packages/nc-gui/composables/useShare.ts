const [setup, use] = useInjectionState(() => {
  const visibility = ref<'public' | 'private'>('private')
  const { project } = useProject()
  const { openedPage, getPageWithParents } = useDocs()

  const isPublic = () => {
    const projectMeta = project.value?.meta as any
    let projectMetaObj
    if (typeof projectMeta === 'string') {
      projectMetaObj = JSON.parse(projectMeta)
    } else {
      projectMetaObj = projectMeta
    }

    const isParentPageNestedPublished = () => {
      if (!openedPage.value) return false

      const pageWithParents = getPageWithParents(openedPage.value!)
      return !!pageWithParents?.find((page) => page.is_nested_published)
    }

    return !!projectMetaObj?.isPublic || openedPage.value?.is_published || isParentPageNestedPublished()
  }

  watch(
    project,
    () => {
      visibility.value = isPublic() ? 'public' : 'private'
    },
    { immediate: true, deep: true },
  )

  watch(
    () => [openedPage.value?.is_published, openedPage.value?.is_nested_published],
    () => {
      visibility.value = isPublic() ? 'public' : 'private'
    },
    { immediate: true, deep: true },
  )

  return {
    visibility,
  }
}, 'useShare')

export const provideShare = setup

export function useShare() {
  const state = use()

  if (!state) {
    return setup()
  }

  return state
}
