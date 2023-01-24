import { message } from 'ant-design-vue'
import type { BookType, DocsPageType } from 'nocodb-sdk'
import gh from 'parse-github-url'
import { extractSdkResponseErrorMsg, useNuxtApp } from '#imports'

export interface AntSidebarNode {
  parentNodeId?: string
  isLeaf: boolean
  key: string
  style?: string | Record<string, string>
  // If `new` is set, the page will have the title on focus
  new?: boolean
  isBook?: boolean
  children?: PageSidebarNode[]
  level?: number
  isSelected?: boolean
}

export type PageSidebarNode = DocsPageType & AntSidebarNode
export type PublishTreeNode = PageSidebarNode & { isSelected: boolean; key: string }

export const PAGES_PER_PAGE_LIST = 10

const [setup, use] = useInjectionState(() => {
  const { $api } = useNuxtApp()
  const route = useRoute()
  const projectId = $(computed(() => route.params.projectId as string))

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
  const openedNestedPagesOfBook = ref([] as PageSidebarNode[])
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

  const isOnlyBookOpened = computed(() => openedBook.value && openedNestedPagesOfBook.value.length === 0)

  const openedPage = computed(() => {
    if (!openedPageSlug.value) return undefined
    if (isFetchingNestedPages.value) return undefined

    return openedNestedPagesOfBook.value.length > 0
      ? openedNestedPagesOfBook.value[openedNestedPagesOfBook.value.length - 1]
      : undefined
  })

  const flattenedNestedPages = computed({
    get: () => {
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
    },
    set: (val) => {
      console.log('setter', val)
    },
  })

  // const isPageDraft = (page: PageSidebarNode) => page.title !== page.published_title || page.content !== page.published_content

  const selectBook = async (book: BookType) => {
    await fetchNestedPages({ book })
    navigateTo(bookUrl(book.slug!))
  }

  const fetchBooks = async () => {
    isFetchingBooks.value = true
    try {
      books.value = await $api.nocoDocs.listBooks({ projectId: projectId! })

      return books
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    } finally {
      isFetchingBooks.value = false
    }
  }

  const fetchPublicBook = async ({ projectId, slug }: { projectId: string; slug?: string }) => {
    isFetchingBooks.value = true
    isBookErrored.value = false
    try {
      const book = await $api.nocoDocs.getPublicBook(slug ?? 'latest', { projectId })
      books.value = [book]

      return books
    } catch (e) {
      console.log(e)
      isBookErrored.value = true
    } finally {
      isFetchingBooks.value = false
    }
  }

  async function fetchNestedPages({ book }: { book: BookType }) {
    isFetchingNestedPages.value = true
    try {
      const nestedDocTree = isPublic.value
        ? await $api.nocoDocs.listPublicPages({
            projectId: projectId!,
            bookId: book.id!,
          })
        : await $api.nocoDocs.listPages({
            projectId: projectId!,
            bookId: book.id!,
          })

      // traverse tree and add `isLeaf` and `key` properties
      const traverse = (parentNode: any, pages: PageSidebarNode[]) => {
        pages.forEach((p) => {
          p.isLeaf = !p.is_parent
          p.key = p.id!
          p.parentNodeId = parentNode.id

          if (p.children) traverse(p, p.children)
        })
      }

      traverse(book, nestedDocTree as any)

      nestedPages.value = nestedDocTree as any

      return nestedDocTree
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    } finally {
      isFetchingNestedPages.value = false
    }
  }

  const fetchPage = async ({ page, book }: { page?: PageSidebarNode; book?: BookType }) => {
    page = page ?? openedPage.value
    book = book ?? openedBook.value

    try {
      const fetchedPage = await $api.nocoDocs.getPage(page!.id!, {
        projectId: projectId!,
        bookId: book!.id!,
      })
      return fetchedPage
    } catch (e) {
      console.log(e)
      isPageErrored.value = true
      return undefined
    }
  }

  // const fetchPublishedPages = async ({ pageNumber, clear }: { pageNumber: number; clear?: boolean }) => {
  //   try {
  //     const docs = await $api.nocoDocs.paginatePages({
  //       projectId: projectId!,
  //       perPage: PAGES_PER_PAGE_LIST,
  //       bookId: openedBook.value!.id!,
  //       pageNumber,
  //       filterField: 'is_published',
  //       filterFieldValue: '1',
  //     })
  //     if (clear) publishedPages.value = []

  //     const newPages = docs.pages?.map((d) => ({ ...d, isLeaf: !d.is_parent, key: d.id!, parentNodeId: d.book_id })) || []
  //     publishedPages.value = [...publishedPages.value, ...newPages]
  //     return { pages: newPages, total: (docs as any).total }
  //   } catch (e) {
  //     console.log(e)
  //     message.error(await extractSdkResponseErrorMsg(e as any))
  //   }
  // }

  async function openChildPagesFromRoute() {
    if (routePageSlugs.value[0] === '') return

    let parentPage: PageSidebarNode | undefined = nestedPages.value.find((page) => page.slug === routePageSlugs.value[0])
    if (!parentPage) {
      isPageErrored.value = true
      return
    }

    const pagesIds = []
    for (const slug of routePageSlugs.value) {
      parentPage = findPage(slug)
      if (!parentPage) {
        isPageErrored.value = true
        return
      }

      pagesIds.push(parentPage.id!)
    }

    for (const id of pagesIds) {
      if (!openedTabs.value.includes(id)) {
        openedTabs.value.push(id)
      }
    }
  }

  const createPage = async ({
    page,
    bookId,
    nodeOverrides,
  }: {
    page: DocsPageType
    bookId: string
    nodeOverrides?: Record<string, any>
  }) => {
    const book = books.value.find((b) => b.id === bookId)! || openedBook.value!
    try {
      let createdPageData = await $api.nocoDocs.createPage({
        attributes: page,
        projectId: projectId!,
        bookId: book.id!,
      })

      if (nodeOverrides) createdPageData = { ...createdPageData, ...nodeOverrides }

      if (page.parent_page_id) {
        const parentPage = findPage(page.parent_page_id)
        if (!parentPage) return

        if (!parentPage.children) parentPage.children = []
        parentPage.children?.push({
          ...createdPageData,
          isLeaf: !createdPageData.is_parent,
          key: createdPageData.id!,
          parentNodeId: parentPage.id,
        })
        parentPage.isLeaf = false
      } else {
        nestedPages.value.push({
          ...createdPageData,
          isLeaf: !createdPageData.is_parent,
          key: createdPageData.id!,
          parentNodeId: book.id,
        })
      }

      await navigateTo(nestedUrl(createdPageData.id!))

      if (!openedTabs.value.includes(createdPageData.id!)) {
        openedTabs.value.push(createdPageData.id!)
      }
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const createBook = async ({ book }: { book: BookType }) => {
    try {
      const createdBook = await $api.nocoDocs.createBook({
        attributes: book,
        projectId: projectId!,
      })

      books.value.push(createdBook)

      navigateTo(bookUrl(createdBook.slug!))
      nestedPages.value = []
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const deleteBook = async ({ id }: { id: string }) => {
    try {
      await $api.nocoDocs.deleteBook(id, {
        projectId: projectId!,
      })

      books.value = books.value.filter((book) => book.id !== id)
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const addNewPage = async (parentPageId?: string) => {
    let dummyTitle = 'Page'
    let conflictCount = 0
    const parentPage = parentPageId && findPage(parentPageId)
    const _pages = parentPage ? parentPage.children : nestedPages.value

    while (_pages?.find((page) => page.title === dummyTitle)) {
      conflictCount++
      dummyTitle = `Page ${conflictCount}`
    }

    await createPage({
      page: {
        title: dummyTitle,
        parent_page_id: parentPageId,
        content: '',
      },
      bookId: openedBook.value!.id!,
      nodeOverrides: {
        new: true,
      },
    })
  }

  const deletePage = async ({ pageId, bookId }: { pageId: string; bookId?: string }) => {
    const book = bookId ? books.value.find((b) => b.id === bookId)! : openedBook.value!
    try {
      const page = findPage(pageId)
      await $api.nocoDocs.deletePage(pageId, { projectId: projectId!, bookId: book.id! })

      if (page?.parent_page_id) {
        const parentPage = findPage(page.parent_page_id)
        if (!parentPage) return

        parentPage.children = parentPage.children?.filter((p) => p.id !== pageId)
        parentPage.isLeaf = parentPage.children?.length === 0
      } else {
        nestedPages.value = nestedPages.value.filter((p) => p.id !== pageId)
      }

      navigateTo(page?.parent_page_id ? nestedUrl(page.parent_page_id) : bookUrl(book.slug!))
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  function bookUrl(bookSlug: string, { completeUrl, publicMode }: { completeUrl?: boolean; publicMode?: boolean } = {}) {
    const publicSlug = routeBookSlug.value ?? bookSlug
    const showPublicUrl = publicMode ?? isPublic.value

    const path: string = showPublicUrl ? `/nc/doc/${projectId!}/public/${publicSlug}` : `/nc/doc/${projectId!}/${bookSlug}`
    return completeUrl ? `${window.location.origin}/#${path}` : path
  }

  function nestedUrl(id: string) {
    const page = findPage(id)!
    const slugs = []
    let parentPage = page
    while (parentPage?.parentNodeId) {
      slugs.unshift(parentPage!.slug!)
      parentPage = findPage(parentPage.parentNodeId)!
    }

    return urlFromPageSlugs(slugs)
  }

  function urlFromPageSlugs(pageSlugs: string[]) {
    const publicBookSlug = routeBookSlug.value ?? books.value[0].slug!
    const url = isPublic.value
      ? `/nc/doc/${projectId!}/public/${publicBookSlug}/${pageSlugs.join('/')}`
      : `/nc/doc/${projectId!}/${openedBook.value!.slug!}/${pageSlugs.join('/')}`
    return url
  }

  const createMagic = async (title: string) => {
    try {
      await $api.nocoDocs.createBookMagic({
        bookId: openedBook.value!.id!,
        projectId: projectId!,
        title,
      })
    } catch (e) {
      message.warning('NocoAI failed for the demo reasons. Please try again.')
    }
  }

  const createImport = async (url: string, type: 'md' | 'nuxt' | 'docusaurus' = 'md', from: 'github' | 'file' = 'github') => {
    try {
      const rs = gh(url)
      await $api.nocoDocs.importBook({
        bookId: openedBook.value!.id!,
        user: rs!.owner!,
        repo: rs!.name!,
        branch: rs!.branch!,
        path: rs!.path!.replace(`${rs?.repo}/tree/${rs?.branch}/`, ''),
        projectId: projectId!,
        type,
        from,
      })
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  function findPage(pageIdOrSlug: string) {
    // traverse the tree and find the parent page
    const findPageInTree = (_pages: PageSidebarNode[], _pageIdOrSlug: string): PageSidebarNode | undefined => {
      if (!_pages) {
        console.error('nestedPages is undefined:', { _pageIdOrSlug, pageIdOrSlug, _pages })
      }
      for (const page of _pages) {
        if (page.id === _pageIdOrSlug || page.slug === _pageIdOrSlug) return page

        if (page.children) {
          const foundPage = findPageInTree(page.children, _pageIdOrSlug)
          if (foundPage) return foundPage
        }
      }
    }

    return findPageInTree(nestedPages.value, pageIdOrSlug)
  }

  const updatePage = async ({ pageId, page }: { pageId: string; page: Partial<PageSidebarNode> }) => {
    const updatedPage = await $api.nocoDocs.updatePage(pageId, {
      attributes: page as any,
      projectId: projectId!,
      bookId: openedBook.value!.id!,
    })
    const foundPage = findPage(pageId)!
    if (page.title) {
      // todo: Update the page in a better way
      foundPage.slug = updatedPage.slug
      foundPage.title = updatedPage.title
      foundPage.updated_at = updatedPage.updated_at
      foundPage.last_updated_by_id = updatedPage.last_updated_by_id

      if (foundPage.new) foundPage.new = false

      await navigateTo(nestedUrl(updatedPage.id!))
    }
  }

  const updateContent = async ({ pageId, content }: { pageId: string; content: string }) => {
    try {
      await $api.nocoDocs.updatePage(pageId, {
        attributes: { content } as any,
        projectId: projectId!,
        bookId: openedBook.value!.id!,
      })
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const navigateToFirstBook = async () => {
    const book = books.value[0]
    await fetchNestedPages({ book })
    await navigateTo(bookUrl(book.slug!))
  }

  const navigateToLastBook = async () => {
    const book = books.value[books.value.length - 1]
    await fetchNestedPages({ book })
    navigateTo(bookUrl(book.slug!))
  }

  const reorderPages = async ({
    sourceNodeId,
    targetNodeId,
    index,
  }: {
    sourceNodeId: string
    targetNodeId?: string
    index: number
  }) => {
    const sourceNode = findPage(sourceNodeId)!
    const targetNode = targetNodeId ? findPage(targetNodeId) : undefined

    const sourceParentNode = findPage(sourceNode.parent_page_id!)
    const sourceNodeSiblings = sourceParentNode ? sourceParentNode.children! : nestedPages.value

    sourceNodeSiblings.splice(
      sourceNodeSiblings.findIndex((node) => node.id === sourceNode.id),
      1,
    )
    if (sourceParentNode) sourceParentNode.isLeaf = sourceParentNode.children?.length === 0

    if (targetNode && !targetNode.children) targetNode.children = []

    const targetNodeSiblings = targetNode ? targetNode.children! : nestedPages.value

    sourceNode.parent_page_id = targetNode?.id
    sourceNode.parentNodeId = targetNode?.id || openedBook.value!.id
    targetNodeSiblings.splice(index, 0, sourceNode)

    const node = findPage(sourceNodeId)!
    await updatePage({ pageId: sourceNodeId, page: { order: index + 1, parent_page_id: targetNode?.id } as any })

    navigateTo(nestedUrl(node.id!))
    const openedPages = [...getPageWithParents(node), node]
    for (const page of openedPages) {
      if (!openedTabs.value.includes(page.id!)) {
        openedTabs.value.push(page.id!)
      }
    }
  }

  function getPageWithParents(page: PageSidebarNode) {
    const parents: PageSidebarNode[] = []
    let parent: PageSidebarNode | undefined = page
    while (parent.parent_page_id) {
      parent = findPage(parent.parent_page_id!)
      if (!parent) break

      parents.push(parent)
    }
    return parents
  }

  const getChildrenOfPage = (pageId?: string) => {
    if (!pageId) return nestedPages.value

    const page = findPage(pageId!)
    if (!page) return []

    return page.children || []
  }

  const openChildPageOfRootPages = async () => {
    for (const page of nestedPages.value) {
      if (!page.is_parent) continue

      if (!openedTabs.value.includes(page.id!)) {
        openedTabs.value.push(page.id!)
      }
    }
  }

  // The page/its parents might not be in nestedPage list
  const openPage = async (page: PageSidebarNode) => {
    const parents = await $api.nocoDocs.parentPages({
      bookId: openedBook.value!.id!,
      pageId: page.id!,
      projectId: projectId!,
    })

    const url = urlFromPageSlugs([...parents.map((p) => p.slug!).reverse(), page.slug!])
    await navigateTo(url)
    openChildPagesFromRoute()
  }

  const uploadFile = async (file: File) => {
    // todo: use a better id
    const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const data = await $api.storage.upload(
      {
        path: [NOCO, projectId, openedBook.value!.id, randomId].join('/'),
      },
      {
        files: file,
        json: '{}',
      },
    )
    return data[0]
  }

  const bulkPublish = async (toBePublishedPages: Array<PageSidebarNode & { isSelected: boolean }>) => {
    isBulkPublishing.value = true
    try {
      await $api.nocoDocs.batchPublishPages({
        projectId: projectId!,
        bookId: openedBook.value!.id!,
        pageIds: toBePublishedPages.map((p) => p.id!),
      })
      toBePublishedPages.forEach((draft) => {
        const page = findPage(draft.id!)
        if (page) {
          page.is_published = true
          page.published_content = page.content
          page.published_title = page.title
        }
      })
    } finally {
      isBulkPublishing.value = false
    }
  }

  async function navigateToFirstPage() {
    const page = nestedPages.value[0]
    await navigateTo(nestedUrl(page.id!))
  }

  const magicExpand = async (text: string, pageId?: string) => {
    const id = pageId || openedPage.value!.id!
    const response = await $api.nocoDocs.magicExpandText({
      projectId: projectId!,
      bookId: openedBook.value!.id!,
      pageId: id,
      text,
    })
    return response
  }

  const magicOutline = async (pageId?: string) => {
    const id = pageId || openedPage.value!.id!
    const response = await $api.nocoDocs.magicOutlinePage({
      projectId: projectId!,
      bookId: openedBook.value!.id!,
      pageId: id,
    })
    return response
  }

  const updateBook = async (bookId: string, attributes: Partial<BookType>) => {
    isBookUpdating.value = true
    try {
      const response = await $api.nocoDocs.updateBook(bookId, {
        projectId: projectId!,
        attributes,
      })
      const index = books.value.findIndex((b) => b.id === bookId)
      books.value[index] = response
    } catch (e) {
      console.error(e)
      message.error('Failed to update book')
    } finally {
      isBookUpdating.value = false
    }
  }

  const getParentOfPage = (pageId: string) => {
    const page = findPage(pageId)
    if (!page) return undefined
    if (!page.parent_page_id) return undefined

    return findPage(page.parent_page_id)
  }

  return {
    fetchNestedPages,
    fetchBooks,
    fetchPublicBook,
    books,
    nestedPages,
    createPage,
    createMagic,
    createImport,
    createBook,
    openedPage,
    openedBook,
    updatePage,
    openedTabs,
    openedNestedPagesOfBook,
    openChildPagesFromRoute,
    bookUrl,
    nestedUrl,
    navigateToFirstBook,
    navigateToLastBook,
    deletePage,
    deleteBook,
    reorderPages,
    selectBook,
    addNewPage,
    getChildrenOfPage,
    openChildPageOfRootPages,
    findPage,
    uploadFile,
    bulkPublish,
    isOnlyBookOpened,
    navigateToFirstPage,
    magicExpand,
    magicOutline,
    // allPages,
    // publishedPages,
    // allByTitle,
    openPage,
    flattenedNestedPages,
    isBulkPublishing,
    isBookUpdating,
    isFetchingNestedPages,
    updateBook,
    isErrored,
    fetchPage,
    updateContent,
    getParentOfPage,
  }
}, 'useDocs')

export const provideDocs = setup

export function useDocs() {
  const state = use()

  if (!state) {
    return setup()
  }

  return state
}
