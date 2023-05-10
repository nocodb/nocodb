import { defineStore } from 'pinia'
import type { DocsPageSnapshotType } from 'nocodb-sdk'

export const useDocHistoryStore = defineStore('docHistoryStore', () => {
  const history = ref<DocsPageSnapshotType[]>([])
  const currentHistory = ref<DocsPageSnapshotType | null>()

  const setHistory = (snapshots: DocsPageSnapshotType[]) => {
    history.value = snapshots
  }

  const setCurrentHistory = (snapshot: DocsPageSnapshotType | null) => {
    currentHistory.value = snapshot
  }

  return {
    history,
    currentHistory,
    setCurrentHistory,
    setHistory,
  }
})
