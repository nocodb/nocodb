import { onKeyStroke } from '@vueuse/core'

const useShortcuts = () => {
  const { project } = storeToRefs(useProject())

  const { openedPage, isEditAllowed } = storeToRefs(useDocStore())
  const { addNewPage, getParentOfPage } = useDocStore()

  const shortCuts = [
    {
      condition: (e: KeyboardEvent) => e.code === 'KeyN' && e.altKey,
      action: (e: KeyboardEvent) => {
        e.preventDefault()

        addNewPage({ parentPageId: openedPage.value?.parent_page_id, projectId: project.value.id! })
      },
    },
    {
      condition: (e: KeyboardEvent) => e.code === 'KeyM' && e.altKey,
      action: (e: KeyboardEvent) => {
        e.preventDefault()

        addNewPage({ parentPageId: openedPage.value?.id, projectId: project.value.id! })
      },
    },
    {
      condition: (e: KeyboardEvent) => e.code === 'KeyH' && e.altKey,
      action: (e: KeyboardEvent) => {
        e.preventDefault()

        const parentPage = openedPage.value?.parent_page_id
          ? getParentOfPage({ pageId: openedPage.value.parent_page_id, projectId: project.value.id! })
          : null
        addNewPage({ parentPageId: parentPage?.id, projectId: project.value.id! })
      },
    },
  ]

  // Listen to shortcuts
  onKeyStroke(
    (e) => shortCuts.some((shortCut) => shortCut.condition(e)),
    (e) => {
      if (!isEditAllowed.value) return

      const shortCut = shortCuts.find((shortCut) => shortCut.condition(e))
      shortCut?.action(e)
    },
    { eventName: 'keydown' },
  )

  return { shortCuts }
}

export { useShortcuts }
