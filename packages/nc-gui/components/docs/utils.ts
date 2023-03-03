import { onKeyStroke } from '@vueuse/core'

const useShortcuts = () => {
  const { openedPage, addNewPage, getParentOfPage, isPublic } = useDocs()

  const shortCuts = !isPublic.value
    ? [
        {
          condition: (e: KeyboardEvent) => e.code === 'KeyN' && e.altKey,
          action: (e: KeyboardEvent) => {
            e.preventDefault()

            addNewPage(openedPage.value?.parent_page_id)
          },
        },
        {
          condition: (e: KeyboardEvent) => e.code === 'KeyM' && e.altKey,
          action: (e: KeyboardEvent) => {
            e.preventDefault()

            addNewPage(openedPage.value?.id)
          },
        },
        {
          condition: (e: KeyboardEvent) => e.code === 'KeyB' && e.altKey,
          action: (e: KeyboardEvent) => {
            e.preventDefault()

            const parentPage = openedPage.value?.parent_page_id ? getParentOfPage(openedPage.value.parent_page_id) : null
            addNewPage(parentPage?.id)
          },
        },
      ]
    : []

  // Listen to shortcuts
  onKeyStroke(
    (e) => shortCuts.some((shortCut) => shortCut.condition(e)),
    (e) => {
      const shortCut = shortCuts.find((shortCut) => shortCut.condition(e))
      shortCut?.action(e)
    },
    { eventName: 'keydown' },
  )

  return { shortCuts }
}

export { useShortcuts }
