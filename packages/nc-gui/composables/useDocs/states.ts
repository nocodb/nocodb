import { findPage } from './actions'
import type { PageSidebarNode } from '~~/lib'

const [setup, use] = useInjectionState(() => {
  const route = useRoute()

  const isPageErrored = ref<boolean>(false)

  const isFetching = ref({
    nestedPages: true,
    page: true,
  })

  const openedNestedPagesOfBook = ref([] as PageSidebarNode[])

  const nestedPages = ref<PageSidebarNode[]>([])

  const openedTabs = ref<string[]>([])

  const isErrored = computed<boolean>(() => {
    return isPageErrored.value
  })

  const slugs = computed<string[]>(() => {
    const slugs = route.params.slugs

    return Array.isArray(slugs) ? slugs.filter((slug) => slug !== '') : []
  })

  const routePageSlugs = computed<string[]>(() => {
    return slugs.value.filter((slug) => slug !== '')
  })

  const isNoPageOpen = computed<boolean>(() => {
    return routePageSlugs.value.length === 0
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

  const openedPageId = computed(() => {
    if (routePageSlugs.value.length === 0) return undefined

    return routePageSlugs.value[0]
  })

  const openedPage = computed(() => {
    if (routePageSlugs.value.length === 0) return undefined
    if (isFetching.value.nestedPages) return undefined

    return findPage(nestedPages.value, routePageSlugs.value[0])
  })

  return {
    isPageErrored,
    isFetching,
    nestedPages,
    openedTabs,
    isErrored,
    routePageSlugs,
    flattenedNestedPages,
    openedPage,
    openedNestedPagesOfBook,
    isNoPageOpen,
    openedPageId,
  }
}, 'useDocs')

export const states = () => {
  const state = use()

  if (!state) {
    return setup()
  }

  return state
}
