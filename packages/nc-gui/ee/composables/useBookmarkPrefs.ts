import { useStorage } from '@vueuse/core'

export type BookmarkLayout = 'list' | 'card'

export interface BookmarkPrefs {
  layout: BookmarkLayout
  listColumns: 1 | 2
}

const DEFAULT_PREFS: BookmarkPrefs = {
  layout: 'list',
  listColumns: 1,
}

export const useBookmarkPrefs = createSharedComposable(() => {
  const stored = useStorage<BookmarkPrefs>('nc-bookmark-prefs', DEFAULT_PREFS, undefined, {
    mergeDefaults: true,
  })

  function setLayout(layout: BookmarkLayout) {
    stored.value = { ...stored.value, layout }
  }

  function setListColumns(n: 1 | 2) {
    stored.value = { ...stored.value, listColumns: n }
  }

  return {
    prefs: stored,
    setLayout,
    setListColumns,
  }
})
