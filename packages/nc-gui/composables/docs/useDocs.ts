import { message } from 'ant-design-vue'
import type { BookType, DocsPageType } from 'nocodb-sdk'
import gh from 'parse-github-url'
import { arrayToTree } from 'performant-array-to-tree'
import { extractSdkResponseErrorMsg, useNuxtApp, useState } from '#imports'

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

export function useDocs() {
  const { $api } = useNuxtApp()
  const route = useRoute()
  const projectId = $(computed(() => route.params.projectId as string))

  const isPublic = inject(IsDocsPublicInj, ref(false))

  const isFetchingPagesFromUrl = useState<boolean>('isFetchingPagesFromUrl', () => false)
  const isBulkPublishing = useState<boolean>('isBulkPublishing', () => false)
  const books = useState<BookType[]>('books', () => [])

  const nestedPages = useState<PageSidebarNode[]>('nestedPages', () => [])
  const allPages = useState<PageSidebarNode[] | undefined>('allPages', () => undefined)
  const drafts = useState<PageSidebarNode[]>('drafts', () => [])
  const publishedPages = useState<PageSidebarNode[]>('publishedPages', () => [])
  const allByTitle = useState<PageSidebarNode[]>('allByTitle', () => [])

  const openedTabs = useState<string[]>('openedSidebarTabs', () => [])

  // First slug is book slug, rest are page slugs
  const openedPageSlug = computed<string | undefined>(() =>
    Number(route.params.slugs?.length) >= 2 ? route.params.slugs[route.params.slugs.length - 1] : undefined,
  )

  const openedBook = computed<BookType | undefined>(() => {
    if (isPublic.value) return books.value?.length > 0 ? books.value[0] : undefined

    if (route.params.slugs?.length === 0) return undefined

    const bookSlug = route.params.slugs[0]
    return books.value.find((b) => b.slug === bookSlug)
  })

  // hack: Since openedPageSlug and nestedPages changes are not in sync, we need to use this
  let prevOpenedPage: PageSidebarNode | undefined

  const openedNestedPagesOfBook = computed(() => {
    if (route.params.slugs?.length < 1 || !openedBook.value || nestedPages.value.length === 0) return []
    if (isFetchingPagesFromUrl.value) return []

    const pageSlugs = (route.params.slugs as string[]).filter((_, i) => i !== 0)

    let currentPages = nestedPages.value
    const _nestedPages = pageSlugs.map((slug) => {
      const rootPage = currentPages.find((p) => p.slug === slug)
      currentPages = rootPage?.children || []

      return rootPage
    }) as PageSidebarNode[]

    // hack: Since openedPageSlug and nestedPages changes are not in sync, last page if its title/slug is editied, it will undefined for a moment
    if (_nestedPages.length === _nestedPages.filter((p) => p).length + 1) {
      _nestedPages[_nestedPages.length - 1] = prevOpenedPage!
    }
    return _nestedPages.filter((p) => p)
  })

  const isOnlyBookOpened = computed(() => openedBook.value && openedNestedPagesOfBook.value.length === 0)

  const openedPage = computed(() => {
    if (!openedPageSlug.value) return undefined
    if (isFetchingPagesFromUrl.value) return undefined

    return openedNestedPagesOfBook.value.length > 0
      ? openedNestedPagesOfBook.value[openedNestedPagesOfBook.value.length - 1]
      : prevOpenedPage
  })

  const nestedDrafts = computed({
    get: () => {
      if (drafts.value.length === 0) return []

      const tree = arrayToTree(drafts.value, {
        parentId: 'parent_page_id',
        id: 'id',
        dataField: null,
      }) as PageSidebarNode[]

      // traverse tree and set level
      const traverse = (pages: PageSidebarNode[], level = 0) => {
        pages.forEach((p) => {
          p.level = level
          if (p.children) traverse(p.children, level + 1)
        })
      }

      traverse(tree)

      return tree
    },
    set: (val) => {
      console.log('setter', val)
    },
  })

  watch(openedPage, (page) => {
    prevOpenedPage = page
  })

  const isPageDraft = (page: PageSidebarNode) => page.title !== page.published_title || page.content !== page.published_content

  const selectBook = async (book: BookType) => {
    await fetchPages({ book })
    navigateTo(bookUrl(book.slug!))
  }

  const fetchBooks = async () => {
    try {
      books.value = await $api.nocoDocs.listBooks({ projectId: projectId! })

      return books
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const fetchPublicBook = async ({ projectId, slug }: { projectId: string; slug?: string }) => {
    try {
      const book = await $api.nocoDocs.getPublicBook(slug ?? 'latest', { projectId })
      books.value = [book]

      return books
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  async function fetchPages({ parentPageId, book }: { parentPageId?: string; book: BookType }) {
    try {
      const docs = isPublic.value
        ? await $api.nocoDocs.listPublicPages({
            projectId: projectId!,
            bookId: book.id!,
            parent_page_id: parentPageId,
          })
        : await $api.nocoDocs.listPages({
            projectId: projectId!,
            parent_page_id: parentPageId,
            bookId: book.id!,
          })

      if (parentPageId) {
        const parentPage = findPage(parentPageId)
        if (!parentPage) return

        parentPage.children = docs.map((d) => ({ ...d, isLeaf: !d.is_parent, key: d.id!, parentNodeId: parentPage.id }))
      } else {
        nestedPages.value = docs.map((d) => ({
          ...d,
          isLeaf: !d.is_parent,
          key: d.id!,
          parentNodeId: book.id,
        }))
      }

      return docs
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const fetchAllPages = async ({ pageNumber, clear }: { pageNumber: number; clear?: boolean }) => {
    try {
      const docs = await $api.nocoDocs.paginatePages({
        projectId: projectId!,
        perPage: PAGES_PER_PAGE_LIST,
        bookId: openedBook.value!.id!,
        pageNumber,
      })
      if (!allPages.value || clear) allPages.value = []

      const newPages = docs.pages?.map((d) => ({ ...d, isLeaf: !d.is_parent, key: d.id!, parentNodeId: d.book_id })) || []
      allPages.value = [...allPages.value, ...newPages]
      return { pages: newPages, total: (docs as any).total }
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const fetchPublishedPages = async ({ pageNumber, clear }: { pageNumber: number; clear?: boolean }) => {
    try {
      const docs = await $api.nocoDocs.paginatePages({
        projectId: projectId!,
        perPage: PAGES_PER_PAGE_LIST,
        bookId: openedBook.value!.id!,
        pageNumber,
        filterField: 'is_published',
        filterFieldValue: '1',
      })
      if (clear) publishedPages.value = []

      const newPages = docs.pages?.map((d) => ({ ...d, isLeaf: !d.is_parent, key: d.id!, parentNodeId: d.book_id })) || []
      publishedPages.value = [...publishedPages.value, ...newPages]
      return { pages: newPages, total: (docs as any).total }
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const fetchAllPagesByTitle = async ({ pageNumber, clear }: { pageNumber: number; clear?: boolean }) => {
    try {
      const docs = await $api.nocoDocs.paginatePages({
        projectId: projectId!,
        perPage: PAGES_PER_PAGE_LIST,
        bookId: openedBook.value!.id!,
        pageNumber,
        sortField: 'title',
        sortOrder: 'asc',
      })
      if (clear) allByTitle.value = []

      const newPages = docs.pages?.map((d) => ({ ...d, isLeaf: !d.is_parent, key: d.id!, parentNodeId: d.book_id })) || []
      allByTitle.value = [...allByTitle.value, ...newPages]

      return { pages: newPages, total: (docs as any).total }
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const fetchDrafts = async (book?: BookType) => {
    try {
      const response = await $api.nocoDocs.listDraftPages({ projectId: projectId!, bookId: book?.id ?? openedBook.value!.id! })
      drafts.value = response.map((d) => ({ ...d, isLeaf: !d.is_parent, key: d.id!, parentNodeId: d.book_id }))
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  async function fetchNestedChildPagesFromRoute() {
    // Since slug will `book-slug/page-slug`, we need to skip if there is no page slug
    if (!route.params.slugs || route.params.slugs.length <= 1) return

    isFetchingPagesFromUrl.value = true

    try {
      let parentPage: PageSidebarNode | undefined = nestedPages.value.find((page) => page.slug === route.params.slugs[1])
      const pagesSlugs = (route.params.slugs as string[])?.filter((_, i) => i > 0)
      const pagesIds = []
      for (const slug of pagesSlugs) {
        const childDocs = await fetchPages({ parentPageId: parentPage?.id, book: openedBook.value! })

        if (parentPage) pagesIds.push(parentPage.id!)

        if (!childDocs) throw new Error(`Nested Child Page not found:${parentPage?.id}`)
        parentPage = { ...parentPage, ...childDocs.find((page) => page.slug === slug), children: parentPage?.children } as any
      }

      for (const id of pagesIds) {
        if (!openedTabs.value.includes(id)) {
          openedTabs.value.push(id)
        }
      }
    } finally {
      isFetchingPagesFromUrl.value = false
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

      const createdPage = findPage(createdPageData.id!)
      drafts.value.push(createdPage!)
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
    let dummyTitle = 'Untitled'
    let conflictCount = 0
    const parentPage = parentPageId && findPage(parentPageId)
    const _pages = parentPage ? parentPage.children : nestedPages.value

    while (_pages?.find((page) => page.title === dummyTitle)) {
      conflictCount++
      dummyTitle = `Untitled ${conflictCount}`
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

  function bookUrl(bookSlug: string) {
    const publicSlug = route.params.slugs?.length > 0 ? route.params.slugs[0] : bookSlug
    return isPublic.value ? `/nc/doc/${projectId!}/public/${publicSlug}` : `/nc/doc/${projectId!}/${bookSlug}`
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
    const publicBookSlug = route.params.slugs?.length > 0 ? route.params.slugs[0] : openedBook.value!.slug!
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
      await fetchDrafts()
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

  const updatePage = async ({ pageId, page }: { pageId: string; page: PageSidebarNode }) => {
    const updatedPage = await $api.nocoDocs.updatePage(pageId, {
      attributes: page,
      projectId: projectId!,
      bookId: openedBook.value!.id!,
    })
    const foundPage = findPage(pageId)!
    if (page.title) {
      foundPage.slug = updatedPage.slug
      if (foundPage.new) foundPage.new = false

      await navigateTo(nestedUrl(updatedPage.id!))
    }
    if (isPageDraft(foundPage)) {
      const inDrafts = drafts.value.find((p) => p.id === foundPage?.id)
      if (!inDrafts) drafts.value.push(foundPage!)
    }
  }

  const navigateToFirstBook = async () => {
    const book = books.value[0]
    await fetchPages({ book })
    await navigateTo(bookUrl(book.slug!))
  }

  const navigateToLastBook = async () => {
    const book = books.value[books.value.length - 1]
    await fetchPages({ book })
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

    console.log('reorderPages', { sourceNode, targetNode, index })

    const shouldFetchParentChildren = targetNode && !targetNode.children

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

    if (shouldFetchParentChildren) {
      await fetchPages({ book: openedBook.value!, parentPageId: targetNode!.id! })
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

  const fetchAndOpenChildPageOfRootPages = async () => {
    for (const page of nestedPages.value) {
      if (!page.is_parent) continue
      await fetchPages({ book: openedBook.value!, parentPageId: page.id! })

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
    fetchNestedChildPagesFromRoute()
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
      drafts.value = drafts.value.filter((draft) => !toBePublishedPages.find((p) => p.id === draft.id))
    } finally {
      isBulkPublishing.value = false
    }
  }

  const navigateToFirstPage = async () => {
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

  return {
    fetchPages,
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
    fetchNestedChildPagesFromRoute,
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
    fetchAndOpenChildPageOfRootPages,
    drafts,
    fetchDrafts,
    findPage,
    uploadFile,
    bulkPublish,
    isOnlyBookOpened,
    navigateToFirstPage,
    magicExpand,
    magicOutline,
    allPages,
    publishedPages,
    allByTitle,
    fetchPublishedPages,
    fetchAllPagesByTitle,
    fetchAllPages,
    openPage,
    nestedDrafts,
    isBulkPublishing,
  }
}
