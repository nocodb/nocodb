import type { PageSidebarNode } from '~~/lib'

export const watchers = () => {
  const isPublic = inject(IsDocsPublicInj, ref(false))

  const {
    routeBookSlug,
    routePageSlugs,
    isBookErrored,
    openedBook,
    isFetchingBooks,
    isFetchingNestedPages,
    isPageErrored,
    nestedPages,
    openedNestedPagesOfBook,
  } = states()

  const { navigateToFirstPage, openChildPagesFromRoute } = actions()

  watch(
    () => [routeBookSlug.value, isFetchingBooks.value],
    () => {
      if (isPublic.value) return
      if (isFetchingBooks.value) return

      if (routeBookSlug.value && !openedBook.value) {
        isBookErrored.value = true
        return
      }

      isBookErrored.value = false
    },
  )

  watch(
    () => [routeBookSlug.value, isFetchingBooks.value],
    (val, oldVal) => {
      if (!isPublic.value) return
      if (isFetchingBooks.value) return
      if (val[0] === oldVal[0]) return

      window.location.reload()

      isBookErrored.value = false
    },
  )

  // Public
  watch(
    () => [isFetchingNestedPages.value, routePageSlugs.value],
    async () => {
      if (!isPublic.value) return
      if (isFetchingNestedPages.value) return
      if (isBookErrored.value) return

      if (routePageSlugs.value.length === 0) {
        await navigateToFirstPage()
      }
    },
  )

  // set openedNestedPagesOfBook when route changes, this is because there is delay between route changes and state changes
  watch(
    () => [routePageSlugs.value, openedBook.value, isFetchingNestedPages.value],
    async () => {
      if (isFetchingBooks.value || !openedBook.value) return
      isPageErrored.value = false

      if (isFetchingNestedPages.value) return

      if (routePageSlugs.value.length === 0) {
        openedNestedPagesOfBook.value = []
        return
      }

      let currentPages = nestedPages.value
      const _nestedPages = routePageSlugs.value
        .map((slug) => {
          const rootPage = currentPages.find((p) => p.slug === slug)
          currentPages = rootPage?.children || []

          return rootPage
        })
        .filter((p) => p !== undefined) as PageSidebarNode[]

      if (_nestedPages.length !== routePageSlugs.value.length) {
        isPageErrored.value = true
        return
      }

      openedNestedPagesOfBook.value = _nestedPages
      openChildPagesFromRoute()
    },
    {
      deep: true,
      immediate: true,
    },
  )
}
