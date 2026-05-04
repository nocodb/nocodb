export interface BookmarkPrefs {
  listColumns: 1 | 2
}

export const useBookmarkPrefs = createSharedComposable(() => {
  const prefs = ref<BookmarkPrefs>({ listColumns: 1 })

  function setListColumns(_n: 1 | 2) {}

  return { prefs, setListColumns }
})
