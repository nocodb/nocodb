const [setup, use] = useInjectionState(() => {
  const visibility = ref<'public' | 'private'>('private')
  const { project } = useProject()
  const { openedPage, parentWhichIsNestedPublished } = useDocs()

  const isPublic = computed(() => {
    const projectMeta = project.value?.meta as any
    let projectMetaObj
    if (typeof projectMeta === 'string') {
      projectMetaObj = JSON.parse(projectMeta)
    } else {
      projectMetaObj = projectMeta
    }

    return !!projectMetaObj?.isPublic || openedPage.value?.is_published || !!parentWhichIsNestedPublished.value
  })

  watch(
    isPublic,
    () => {
      visibility.value = isPublic.value ? 'public' : 'private'
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
