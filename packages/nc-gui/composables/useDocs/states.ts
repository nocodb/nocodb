import type { BookType } from 'nocodb-sdk'
import type { PageSidebarNode } from '~~/lib'

const [setup, use] = useInjectionState(() => {
  const route = useRoute()
  const isPublic = inject(IsDocsPublicInj, ref(false))

  const isPageErrored = ref<boolean>(false)
  const isBookErrored = ref<boolean>(false)

  const isFetching = ref({
    books: true,
    nestedPages: true,
    page: true,
  })

  const isBulkPublishing = ref<boolean>(false)

  const books = ref<BookType[]>([])

  const openedNestedPagesOfBook = ref([] as PageSidebarNode[])

  const nestedPages = ref<PageSidebarNode[]>([])

  // const allPages = ref<PageSidebarNode[] | undefined>(undefined)
  // const publishedPages = ref<PageSidebarNode[]>([])
  // const allByTitle = ref<PageSidebarNode[]>([])

  const isBookUpdating = ref<boolean>(false)
  const openedTabs = ref<string[]>([])

  const isErrored = computed<boolean>(() => {
    return isPageErrored.value || isBookErrored.value
  })

  const slugs = computed<string[]>(() => {
    const slugs = route.params.slugs

    return Array.isArray(slugs) ? slugs.filter((slug) => slug !== '') : []
  })

  const routeBookSlug = computed<string | undefined>(() => {
    return slugs.value[0]
  })

  const routePageSlugs = computed<string[]>(() => {
    return slugs.value.filter((_, i) => i > 0)
  })

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

  const isOnlyBookOpened = computed(
    () => openedBook.value && openedNestedPagesOfBook.value.length === 0 && slugs.value.length === 1,
  )

  const openedPage = computed(() => {
    if (routePageSlugs.value.length === 0) return undefined
    if (isFetching.value.nestedPages) return undefined

    return openedNestedPagesOfBook.value.length > 0
      ? openedNestedPagesOfBook.value[openedNestedPagesOfBook.value.length - 1]
      : undefined
  })

  return {
    isPageErrored,
    isBookErrored,
    isFetching,
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
