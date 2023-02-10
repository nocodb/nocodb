import { onKeyStroke } from '@vueuse/core'

const useShortCuts = () => {
  const isPublic = inject(IsDocsPublicInj, ref(false))

  const { openedPage, addNewPage, getParentOfPage } = useDocs()

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
            addNewPage(parentPage?.parent_page_id)
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

export default useShortCuts
