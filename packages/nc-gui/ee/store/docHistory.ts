import { defineStore } from 'pinia'
import type { DocsPageSnapshotType } from 'nocodb-sdk'

export const useDocHistoryStore = defineStore('docHistoryStore', () => {
  const { $api } = useNuxtApp()
  const { openedPage, openedProjectId } = storeToRefs(useDocStore())
  const { fetchPage } = useDocStore()

  const isHistoryPaneOpen = ref(false)
  const isRestoring = ref(false)
  const history = ref<DocsPageSnapshotType[]>([])
  const currentSnapshotIndex = ref<number | undefined>()

  const currentSnapshot = computed(() => {
    if (currentSnapshotIndex.value === undefined) return undefined
    return history.value[currentSnapshotIndex.value]
  })
  // Next index in history as history is stored in reverse order
  const prevSnapshot = computed(() => {
    if (currentSnapshotIndex.value === undefined) return undefined
    if (currentSnapshotIndex.value + 1 === history.value.length) return null

    return history.value[currentSnapshotIndex.value + 1]
  })

  const setHistory = (snapshots: DocsPageSnapshotType[]) => {
    history.value = snapshots
  }

  const setCurrentSnapshotIndex = (index: number | undefined) => {
    currentSnapshotIndex.value = index
  }

  const restore = async () => {
    const snapshot = currentSnapshot.value
    if (!snapshot) return

    isRestoring.value = true
    try {
      isRestoring.value = true
      await $api.nocoDocs.restorePageHistory(openedProjectId.value, openedPage.value?.id as string, snapshot.id!)

      openedPage.value = (await fetchPage({
        projectId: openedProjectId.value,
        doNotSetProject: true,
      })) as any

      currentSnapshotIndex.value = undefined

      isHistoryPaneOpen.value = false
    } finally {
      isRestoring.value = false
    }
  }

  watch(
    () => openedPage.value?.id,
    async () => {
      currentSnapshotIndex.value = undefined
      isHistoryPaneOpen.value = false
    },
  )

  return {
    history,
    currentSnapshot,
    prevSnapshot,
    setCurrentSnapshotIndex,
    setHistory,
    restore,
    isHistoryPaneOpen,
    isRestoring,
  }
})
