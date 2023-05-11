import { defineStore } from 'pinia'
import type { DocsPageSnapshotType } from 'nocodb-sdk'

interface DocsPageSnapshotTypeWithPage extends DocsPageSnapshotType {
  before_page?: DocsPageSnapshotType | null
  after_page?: DocsPageSnapshotType | null
}

export const useDocHistoryStore = defineStore('docHistoryStore', () => {
  const history = ref<DocsPageSnapshotTypeWithPage[]>([])
  const currentHistory = ref<DocsPageSnapshotTypeWithPage | null>()

  const setHistory = (snapshots: DocsPageSnapshotTypeWithPage[]) => {
    history.value = snapshots
  }

  const setCurrentHistory = (snapshot: DocsPageSnapshotTypeWithPage | null) => {
    if(snapshot) {
      snapshot.before_page = snapshot.before_page_json ? JSON.parse(snapshot.before_page_json as string): null
      snapshot.after_page = snapshot.after_page_json ? JSON.parse(snapshot.after_page_json as string): null
    }
    currentHistory.value = snapshot
  }

  return {
    history,
    currentHistory,
    setCurrentHistory,
    setHistory,
  }
})
