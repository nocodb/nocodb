import { defineStore } from 'pinia'
import type { DocsPageSnapshotType } from 'nocodb-sdk'

interface DocsPageSnapshotTypeWithPage extends DocsPageSnapshotType {
  before_page?: DocsPageSnapshotType | null
  after_page?: DocsPageSnapshotType | null
}

export const useDocHistoryStore = defineStore('docHistoryStore', () => {
  const { $api } = useNuxtApp()
  const { openedPage, openedProjectId } = storeToRefs(useDocStore())
  const { fetchPage } = useDocStore()

  const isHistoryPaneOpen = ref(false)
  const isRestoring = ref(false)
  const history = ref<DocsPageSnapshotTypeWithPage[]>([])
  const currentHistory = ref<DocsPageSnapshotTypeWithPage | null>()

  const setHistory = (snapshots: DocsPageSnapshotTypeWithPage[]) => {
    history.value = snapshots
  }

  const setCurrentHistory = (snapshot: DocsPageSnapshotTypeWithPage | null) => {
    if (snapshot) {
      snapshot.before_page = snapshot.before_page_json ? JSON.parse(snapshot.before_page_json as string) : null
      snapshot.after_page = snapshot.after_page_json ? JSON.parse(snapshot.after_page_json as string) : null
    }

    currentHistory.value = snapshot
  }

  const restore = async () => {
    const snapshot = currentHistory.value
    if (!snapshot) return

    isRestoring.value = true
    try {
      isRestoring.value = true
      await $api.nocoDocs.restorePageHistory(openedProjectId.value, openedPage.value?.id as string, snapshot.id!)

      openedPage.value = (await fetchPage({
        projectId: openedProjectId.value,
        doNotSetProject: true,
      })) as any

      currentHistory.value = null

      isHistoryPaneOpen.value = false
    } finally {
      isRestoring.value = false
    }
  }

  watch(
    () => openedPage.value?.id,
    async () => {
      currentHistory.value = null
    },
  )

  return {
    history,
    currentHistory,
    setCurrentHistory,
    setHistory,
    restore,
    isHistoryPaneOpen,
    isRestoring,
  }
})
