import { useStorage } from '@vueuse/core'

export interface BookmarkPrefs {
  listColumns: 1 | 2
}

const DEFAULT_PREFS: BookmarkPrefs = {
  listColumns: 1,
}

export const useBookmarkPrefs = createSharedComposable(() => {
  const stored = useStorage<BookmarkPrefs>('nc-bookmark-prefs', DEFAULT_PREFS, undefined, {
    mergeDefaults: true,
  })

  function setListColumns(n: 1 | 2) {
    stored.value = { ...stored.value, listColumns: n }
  }

  return {
    prefs: stored,
    setListColumns,
  }
})
