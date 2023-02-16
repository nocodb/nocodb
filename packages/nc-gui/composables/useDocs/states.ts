import type { BookType } from 'nocodb-sdk'
import type { PageSidebarNode } from '~~/lib'

const [setup, use] = useInjectionState(() => {
  const route = useRoute()
  const isPublic = inject(IsDocsPublicInj, ref(false))

  const isPageErrored = ref<boolean>(false)
  const isBookErrored = ref<boolean>(false)

  const isFetchingBooks = ref<boolean>(true)
  const isFetchingNestedPages = ref<boolean>(true)
  const isBulkPublishing = ref<boolean>(false)
  const books = ref<BookType[]>([])

  const nestedPages = ref<PageSidebarNode[]>([])
  // const allPages = ref<PageSidebarNode[] | undefined>(undefined)
  // const publishedPages = ref<PageSidebarNode[]>([])
  // const allByTitle = ref<PageSidebarNode[]>([])
  const isBookUpdating = ref<boolean>(false)
  const openedTabs = ref<string[]>([])

  const isErrored = computed<boolean>(() => isPageErrored.value || isBookErrored.value)

  const routeBookSlug = computed<string | undefined>(() => {
    return route.params.slugs?.[0] as string
  })
  const routePageSlugs = computed<string[]>(() => {
    const slugs = route.params.slugs

    return Array.isArray(slugs) ? slugs.filter((slug, index) => slug !== '' && index !== 0) : []
  })

  const openedPageSlug = computed<string | undefined>(() =>
    routePageSlugs.value.length > 0 ? routePageSlugs.value[routePageSlugs.value.length - 1] : undefined,
  )

  const openedBook = computed<BookType | undefined>(() => {
    if (isPublic.value) return books.value?.length > 0 ? books.value[0] : undefined

    if (!routeBookSlug.value) return undefined

    return books.value.find((b) => b.slug === routeBookSlug.value)
  })

  const flattenedNestedPages = computed(() => {
    if (nestedPages.value.length === 0) return []

    // nestedPagesTree to array
    const flatten = (tree: PageSidebarNode[]): PageSidebarNode[] => {
      const result: PageSidebarNode[] = []

      tree.forEach((node) => {
        result.push(node)
        if (node.children) {
          result.push(...flatten(node.children))
        }
      })

      return result
    }

    return flatten(nestedPages.value)
  })

  const openedNestedPagesOfBook = ref([] as PageSidebarNode[])

  const isOnlyBookOpened = computed(() => openedBook.value && openedNestedPagesOfBook.value.length === 0)

  const openedPage = computed(() => {
    if (!openedPageSlug.value) return undefined
    if (isFetchingNestedPages.value) return undefined

    return openedNestedPagesOfBook.value.length > 0
      ? openedNestedPagesOfBook.value[openedNestedPagesOfBook.value.length - 1]
      : undefined
  })

  return {
    isPageErrored,
    isBookErrored,
    isFetchingBooks,
    isFetchingNestedPages,
    isBulkPublishing,
    books,
    nestedPages,
    // allPages,
    // publishedPages,
    // allByTitle,
    isBookUpdating,
    openedTabs,
    isErrored,
    routeBookSlug,
    routePageSlugs,
    openedPageSlug,
    openedBook,
    flattenedNestedPages,
    isOnlyBookOpened,
    openedPage,
    openedNestedPagesOfBook,
  }
}, 'useDocs')

export const states = () => {
  const state = use()

  if (!state) {
    return setup()
  }

  return state
}
