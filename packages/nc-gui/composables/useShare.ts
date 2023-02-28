const [setup, use] = useInjectionState(() => {
  const visibility = ref<'public' | 'private'>('private')
  const { project } = useProject()
  const { openedPage } = useDocs()

  const isPublic = () => {
    const projectMeta = project.value?.meta as any
    let projectMetaObj
    if (typeof projectMeta === 'string') {
      projectMetaObj = JSON.parse(projectMeta)
    } else {
      projectMetaObj = projectMeta
    }
    return !!projectMetaObj?.isPublic || openedPage.value?.is_published
  }

  watch(
    project,
    () => {
      visibility.value = isPublic() ? 'public' : 'private'
    },
    { immediate: true, deep: true },
  )

  watch(
    () => openedPage.value?.is_published,
    () => {
      visibility.value = isPublic() ? 'public' : 'private'
    },
    { immediate: true },
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
