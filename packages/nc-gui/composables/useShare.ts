const [setup, use] = useInjectionState(() => {
  const visibility = ref<'public' | 'private' | 'none'>('none')
  const { openedPage, isEditAllowed } = useDocs()

  watch(
    [openedPage, isEditAllowed],
    () => {
      if (!isEditAllowed.value) {
        visibility.value = 'none'
        return
      }

      visibility.value = openedPage.value?.is_published ? 'public' : 'private'
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
