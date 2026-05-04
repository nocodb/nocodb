import { useStorage } from '@vueuse/core'

export type BookmarkLayout = 'stack' | 'mosaic'

export interface BookmarkPrefs {
  layout: BookmarkLayout
  stackColumns: 1 | 2
}

const DEFAULT_PREFS: BookmarkPrefs = {
  layout: 'stack',
  stackColumns: 1,
}

export const useBookmarkPrefs = createSharedComposable(() => {
  const stored = useStorage<BookmarkPrefs>('nc-bookmark-prefs', DEFAULT_PREFS, undefined, {
    mergeDefaults: true,
  })

  function setLayout(layout: BookmarkLayout) {
    stored.value = { ...stored.value, layout }
  }

  function setStackColumns(n: 1 | 2) {
    stored.value = { ...stored.value, stackColumns: n }
  }

  return {
    prefs: stored,
    setLayout,
    setStackColumns,
  }
})
