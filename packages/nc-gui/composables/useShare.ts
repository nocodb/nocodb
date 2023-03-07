const [setup, use] = useInjectionState(() => {
  const visibility = ref<'public' | 'private' | 'none'>('none')
  const { project } = useProject()
  const { openedPage, parentWhichIsNestedPublished, isEditAllowed } = useDocs()

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
      if (!isEditAllowed.value) {
        visibility.value = 'none'
        return
      }

      visibility.value = isPublic.value ? 'public' : 'private'
    },
    { immediate: true },
  )

  watch(
    isEditAllowed,
    () => {
      if (!isEditAllowed.value) {
        visibility.value = 'none'
      }
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
