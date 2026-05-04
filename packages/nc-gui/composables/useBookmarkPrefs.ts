export type BookmarkLayout = 'list' | 'card'

export interface BookmarkPrefs {
  layout: BookmarkLayout
  listColumns: 1 | 2
}

export const useBookmarkPrefs = createSharedComposable(() => {
  const prefs = ref<BookmarkPrefs>({ layout: 'list', listColumns: 1 })

  function setLayout(_l: BookmarkLayout) {}
  function setListColumns(_n: 1 | 2) {}

  return { prefs, setLayout, setListColumns }
})
