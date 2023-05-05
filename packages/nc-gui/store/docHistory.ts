import { defineStore } from 'pinia'
import type { DocsPageType } from 'nocodb-sdk'

export const useDocHistoryStore = defineStore('docHistoryStore', () => {
  const history = ref<DocsPageType[]>([])
  const currentHistory = ref<DocsPageType | null>()

  const { openedPage } = storeToRefs(useDocStore())

  watch(
    () => openedPage.value?.content,
    (newPageContent, oldPageContent) => {
      if (!newPageContent) return
      if (newPageContent === oldPageContent) return

      history.value.push({
        ...openedPage.value!,
        content: newPageContent,
      })
    },
    {
      deep: true,
    },
  )

  const setCurrentHistory = (page: DocsPageType | null) => {
    currentHistory.value = page
  }

  return {
    history,
    setCurrentHistory,
    currentHistory,
  }
})
