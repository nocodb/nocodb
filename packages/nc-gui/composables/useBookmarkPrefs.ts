export type BookmarkLayout = 'stack' | 'mosaic'

export interface BookmarkPrefs {
  layout: BookmarkLayout
  stackColumns: 1 | 2
}

export const useBookmarkPrefs = createSharedComposable(() => {
  const prefs = ref<BookmarkPrefs>({ layout: 'stack', stackColumns: 1 })

  function setLayout(_l: BookmarkLayout) {}
  function setStackColumns(_n: 1 | 2) {}

  return { prefs, setLayout, setStackColumns }
})
