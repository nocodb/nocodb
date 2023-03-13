const [setup, use] = useInjectionState(() => {
  const visibility = ref<'public' | 'private' | 'none' | 'hidden'>('none')
  const { openedPage, isEditAllowed } = useDocs()

  const showShareModal = ref(false)

  watch(
    [openedPage, isEditAllowed],
    () => {
      if (!isEditAllowed.value) {
        visibility.value = 'hidden'
        return
      }

      if (!openedPage.value) {
        visibility.value = 'none'
        return
      }

      visibility.value = openedPage.value.is_published ? 'public' : 'private'
    },
    { immediate: true, deep: true },
  )

  return {
    visibility,
    showShareModal,
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
