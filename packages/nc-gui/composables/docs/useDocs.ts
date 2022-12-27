import { message } from 'ant-design-vue'
import type { BookType, DocsPageType } from 'nocodb-sdk'
import gh from 'parse-github-url'
import { extractSdkResponseErrorMsg, useNuxtApp, useState } from '#imports'
export interface AntSidebarNode {
  parentNodeSlug?: string
  isLeaf: boolean
  key: string
  style?: string | Record<string, string>
  // If `new` is set, the page will have the title on focus
  new?: boolean
  isBook?: boolean
  children?: PageSidebarNode[]
}

export type PageSidebarNode = DocsPageType & AntSidebarNode

export type BookSidebarNode = BookType & AntSidebarNode

export function useDocs() {
  const { $api } = useNuxtApp()
  const route = useRoute()
  const { project } = $(useProject())

  const books = useState<BookSidebarNode[]>('books', () => [])
  const pages = useState<PageSidebarNode[]>('pages', () => [])
  const openedTabs = useState<string[]>('openedSidebarTabs', () => [])

  // First slug is book slug, rest are page slugs
  const openedPageSlug = computed<string | undefined>(() =>
    Number(route.params.slugs?.length) >= 2 ? route.params.slugs[route.params.slugs.length - 1] : undefined,
  )
  const openedBook = computed<BookSidebarNode | undefined>(() => {
    if (route.params.slugs?.length === 0) return undefined

    const bookSlug = route.params.slugs[0]
    return books.value.find((b) => b.slug === bookSlug)
  })

  // hack: Since openedPageSlug and pages changes are not in sync, we need to use this
  const prevOpenedPage = ref<PageSidebarNode | undefined>()

  const openedPage = computed(() => {
    return openedPageSlug.value ? findPage(openedPageSlug.value) || prevOpenedPage.value : undefined
  })

  watch(openedPage, (page) => {
    prevOpenedPage.value = page
  })

  const openedNestedPagesOfBook = computed(() => {
    if (route.params.slugs?.length < 1 || !openedBook.value) return []
    const pageSlugs = (route.params.slugs as string[]).filter((_, i) => i !== 0)

    return pageSlugs.map((slug) => findPage(slug)).filter((p) => p) as PageSidebarNode[]
  })

  const selectBook = async (book: BookSidebarNode) => {
    console.log('selectBook', pages.value)
    await fetchPages({ book })
    navigateTo(bookUrl(book.slug!))
  }

  const fetchBooks = async ({ fetchChildPages }: { fetchChildPages?: boolean } = {}) => {
    try {
      books.value = (await $api.nocoBooks.listBooks({ projectId: project.id! })).map((book) => ({
        ...book,
        isLeaf: false,
        key: book.slug!,
        isBook: true,
      }))

      if (fetchChildPages) {
        for (const book of books.value) {
          await fetchPages({ book })
        }
      }

      return books
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  async function fetchPages({ parentPageId, book }: { parentPageId?: string; book: BookSidebarNode }) {
    try {
      const docs = await $api.nocoDocs.listPages({
        projectId: project.id!,
        parent_page_id: parentPageId,
        bookId: book.id!,
      })

      if (parentPageId) {
        const parentPage = findPage(parentPageId)
        if (!parentPage) return

        parentPage.children = docs.map((d) => ({ ...d, isLeaf: !d.is_parent, key: d.slug!, parentNodeSlug: parentPage.slug }))
      } else {
        pages.value = docs.map((d) => ({
          ...d,
          isLeaf: !d.is_parent,
          key: d.slug!,
          parentNodeSlug: book.slug,
        }))
      }

      return docs
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  async function fetchNestedChildPagesFromRoute() {
    // Since slug will `book-slug/page-slug`, we need to skip if there is no page slug
    if (!route.params.slugs || route.params.slugs.length <= 1) return

    let parentPage: DocsPageType | undefined = pages.value.find((page) => page.slug === route.params.slugs[1])
    const pagesSlugs = route.params.slugs as string[]

    for (const slug of pagesSlugs) {
      const childDocs = await fetchPages({ parentPageId: parentPage?.id, book: openedBook.value! })

      if (!childDocs) throw new Error(`Nested Child Page not found:${parentPage?.id}`)
      parentPage = childDocs.find((page) => page.slug === slug)
    }

    for (const slug of pagesSlugs) {
      if (!openedTabs.value.includes(slug)) {
        openedTabs.value.push(slug)
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
        projectId: project.id!,
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
          key: createdPageData.slug!,
          parentNodeSlug: parentPage.slug,
        })
        parentPage.isLeaf = false
      } else {
        pages.value.push({
          ...createdPageData,
          isLeaf: !createdPageData.is_parent,
          key: createdPageData.slug!,
          parentNodeSlug: book.slug,
        })
      }

      await navigateTo(nestedUrl(createdPageData.slug!))

      if (!openedTabs.value.includes(createdPageData.slug!)) {
        openedTabs.value.push(createdPageData.slug!)
      }
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const createBook = async ({ book }: { book: BookType }) => {
    try {
      const createdBook = await $api.nocoBooks.createBook({
        attributes: book,
        projectId: project.id!,
      })

      books.value.push({
        ...createdBook,
        isLeaf: false,
        key: createdBook.slug!,
        isBook: true,
      })

      navigateTo(bookUrl(createdBook.slug!))
      pages.value = []
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const deleteBook = async ({ id }: { id: string }) => {
    try {
      await $api.nocoBooks.deleteBook(id, {
        projectId: project.id!,
      })

      books.value = books.value.filter((book) => book.id !== id)
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const addNewPage = async (parentPageId?: string) => {
    let dummyTitle = 'Untitled'
    let conflictCount = 0
    const parentPage = parentPageId && findPage(parentPageId)
    const _pages = parentPage ? parentPage.children : pages.value

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
      await $api.nocoDocs.deletePage(pageId, { projectId: project.id!, bookId: book.id! })

      if (page?.parent_page_id) {
        const parentPage = findPage(page.parent_page_id)
        if (!parentPage) return

        parentPage.children = parentPage.children?.filter((p) => p.id !== pageId)
        parentPage.isLeaf = parentPage.children?.length === 0
      } else {
        pages.value = pages.value.filter((p) => p.id !== pageId)
      }

      navigateTo(page?.parent_page_id ? nestedUrl(page.parent_page_id) : bookUrl(book.slug!))
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  function bookUrl(bookSlug: string) {
    return `/nc/doc/${project.id!}/${bookSlug}`
  }

  function nestedUrl(slug: string) {
    const page = findPage(slug)!
    const slugs = [page.slug!]
    let parentPage = page
    while (parentPage?.parentNodeSlug) {
      slugs.unshift(parentPage.parentNodeSlug)
      parentPage = findPage(parentPage.parentNodeSlug)!
    }

    // Will include book slug, as we use `parentNodeSlug` which is book slug for root pages
    return `/nc/doc/${project.id!}/${slugs.join('/')}`
  }

  const createMagic = async (title: string) => {
    try {
      await $fetch(`/api/v1/docs/magic`, {
        method: 'POST',
        baseURL,
        headers: { 'xc-auth': $state.token.value as string },
        body: {
          title,
          projectId: project.id!,
        },
      })
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const createImport = async (url: string, type: 'md' | 'nuxt' | 'docusaurus' = 'md', from: 'github' | 'file' = 'github') => {
    try {
      const rs = gh(url)
      await $fetch(`/api/v1/docs/import`, {
        method: 'POST',
        baseURL,
        headers: { 'xc-auth': $state.token.value as string },
        body: {
          user: rs?.owner,
          repo: rs?.name,
          branch: rs?.branch,
          path: rs?.path?.replace(`${rs?.repo}/tree/${rs?.branch}/`, ''),
          projectId: project.id!,
          type,
          from,
        },
      })
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  function findPage(pageIdOrSlug: string) {
    // traverse the tree and find the parent page
    const findPageInTree = (_pages: PageSidebarNode[], _pageIdOrSlug: string): PageSidebarNode | undefined => {
      if (!_pages) {
        console.error('pages is undefined:', { _pageIdOrSlug, pageIdOrSlug, _pages })
      }
      for (const page of _pages) {
        if (page.id === _pageIdOrSlug || page.slug === _pageIdOrSlug) return page

        if (page.children) {
          const foundPage = findPageInTree(page.children, _pageIdOrSlug)
          if (foundPage) return foundPage
        }
      }
    }

    return findPageInTree(pages.value, pageIdOrSlug)
  }

  const updatePage = async ({ pageId, page }: { pageId: string; page: PageSidebarNode }) => {
    const updatedPage = await $api.nocoDocs.updatePage(pageId, {
      attributes: page,
      projectId: project.id!,
      bookId: openedBook.value!.id!,
    })
    if (page.title) {
      const foundPage = findPage(pageId)
      const oldSlug = foundPage!.slug
      if (foundPage) {
        foundPage.slug = updatedPage.slug
        if (foundPage.new) foundPage.new = false
      }

      if (openedTabs.value.find((t) => t === oldSlug)) {
        openedTabs.value = openedTabs.value.filter((t) => t !== oldSlug)
        openedTabs.value.push(page.slug!)
      }

      await navigateTo(nestedUrl(updatedPage.slug!))
    }
  }

  const navigateToFirstBook = async () => {
    const book = books.value[0]
    await fetchPages({ book })
    navigateTo(bookUrl(book.slug!))
  }

  const reorderPages = async ({
    sourceNodeId,
    targetParentNodeId,
    index,
  }: {
    sourceNodeId: string
    targetParentNodeId?: string
    index: number
  }) => {
    const sourceNode = findPage(sourceNodeId)!
    const targetParentNode = targetParentNodeId && findPage(targetParentNodeId)
    const sourceParentNode = findPage(sourceNode.parent_page_id!)

    if (!sourceParentNode && targetParentNode) return
    if (sourceParentNode && !targetParentNode) return

    if (sourceParentNode?.children) {
      sourceParentNode.children = sourceParentNode.children.filter((p) => p.id !== sourceNode.id)
      sourceParentNode.isLeaf = sourceParentNode.children.length === 0
    }

    if (!targetParentNode) {
      index = index < 0 ? 0 : index
      // index of the source node
      const sourceIndex = books.value.findIndex((p) => p.id === sourceNode.id)
      // move the index to the correct position
      if (index > books.value.length) {
        index = books.value.length
      }
      books.value.splice(index, 0, sourceNode as BookSidebarNode)
      // remove the previous duplicate node by source index
      if (index > sourceIndex) {
        books.value.splice(sourceIndex, 1)
      } else {
        books.value.splice(sourceIndex + 1, 1)
      }

      sourceNode.parent_page_id = undefined
      sourceNode.parentNodeSlug = undefined

      const node = findPage(sourceNodeId)!
      await $api.nocoDocs.updatePage(node.id!, {
        attributes: { order: index + 1 } as any,
        projectId: project.id!,
        bookId: openedBook.value!.id!,
      })
      return
    }

    if (targetParentNode.children) {
      targetParentNode.children.splice(index, 0, sourceNode)
      targetParentNode.isLeaf = false
    } else {
      targetParentNode.children = [sourceNode]
      targetParentNode.isLeaf = false
    }

    sourceNode.parent_page_id = targetParentNode.id
    sourceNode.parentNodeSlug = targetParentNode.slug

    const node = findPage(sourceNodeId)!
    await $api.nocoDocs.updatePage(node.id!, {
      attributes: { order: index + 1, parent_page_id: targetParentNodeId } as any,
      projectId: project.id!,
      bookId: openedBook.value!.id!,
    })

    navigateTo(nestedUrl(node.slug!))
    for (const slug of route.params.slugs) {
      if (!openedTabs.value.includes(slug)) {
        openedTabs.value.push(slug)
      }
    }
  }

  return {
    fetchPages,
    fetchBooks,
    books,
    pages,
    createPage,
    createMagic,
    createImport,
    createBook,
    openedPageSlug,
    openedPage,
    openedBook,
    updatePage,
    openedTabs,
    openedNestedPagesOfBook,
    fetchNestedChildPagesFromRoute,
    bookUrl,
    nestedUrl,
    navigateToFirstBook,
    deletePage,
    deleteBook,
    reorderPages,
    selectBook,
    addNewPage,
  }
}
