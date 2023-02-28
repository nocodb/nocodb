import { message } from 'ant-design-vue'
import type { DocsPageType } from 'nocodb-sdk'
import gh from 'parse-github-url'
import { extractSdkResponseErrorMsg, useNuxtApp } from '#imports'
import type { PageSidebarNode } from '~~/lib'

export const PAGES_PER_PAGE_LIST = 10

const [setup, use] = useInjectionState(() => {
  const route = useRoute()
  const { $api } = useNuxtApp()
  const { appInfo } = $(useGlobal())
  const isPublic = inject(IsDocsPublicInj, ref(false))

  const projectId = $(computed(() => route.params.projectId as string))

  const isPageErrored = ref<boolean>(false)

  const isFetching = ref({
    nestedPages: true,
    page: true,
  })

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

  const openedNestedPages = computed(() => (openedPage.value ? getPageWithParents(openedPage.value) : []))

  async function fetchNestedPages() {
    isFetching.value.nestedPages = true
    try {
      const nestedDocTree = isPublic.value
        ? await $api.nocoDocs.listPublicPages({
            projectId: projectId!,
          })
        : await $api.nocoDocs.listPages({
            projectId: projectId!,
          })

      // traverse tree and add `isLeaf` and `key` properties
      const traverse = (parentNode: any, pages: PageSidebarNode[]) => {
        pages.forEach((p) => {
          p.isLeaf = !p.is_parent
          p.key = p.id!
          p.parentNodeId = parentNode?.id

          if (p.children) traverse(p, p.children)
        })
      }

      traverse(undefined, nestedDocTree as any)

      nestedPages.value = nestedDocTree as any

      return nestedDocTree
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    } finally {
      isFetching.value.nestedPages = false
    }
  }

  const fetchPage = async ({ page }: { page?: PageSidebarNode } = {}) => {
    const pageId = page?.id || routePageSlugs.value?.[0]
    if (!pageId) throw new Error('No page id or slug provided')

    try {
      return isPublic.value
        ? await $api.nocoDocs.getPublicPage(pageId, {
            projectId: projectId!,
          })
        : await $api.nocoDocs.getPage(pageId, {
            projectId: projectId!,
          })
    } catch (e) {
      console.log(e)
      isPageErrored.value = true
      return undefined
    }
  }

  const createPage = async ({ page, nodeOverrides }: { page: DocsPageType; nodeOverrides?: Record<string, any> }) => {
    try {
      let createdPageData = await $api.nocoDocs.createPage({
        attributes: page,
        projectId: projectId!,
      })

      if (nodeOverrides) createdPageData = { ...createdPageData, ...nodeOverrides }

      if (page.parent_page_id) {
        const parentPage = findPage(nestedPages.value, page.parent_page_id)
        if (!parentPage) return

        if (!parentPage.children) parentPage.children = []
        parentPage.children?.push({
          ...createdPageData,
          isLeaf: !createdPageData.is_parent,
          key: createdPageData.id!,
          parentNodeId: parentPage.id,
          children: [],
        })
        parentPage.isLeaf = false
      } else {
        nestedPages.value.push({
          ...createdPageData,
          isLeaf: !createdPageData.is_parent,
          key: createdPageData.id!,
          parentNodeId: undefined,
          children: [],
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

  const addNewPage = async (parentPageId?: string) => {
    let dummyTitle = 'Page'
    let conflictCount = 0
    const parentPage = parentPageId && findPage(nestedPages.value, parentPageId)
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
      nodeOverrides: {
        new: true,
      },
    })
  }

  const deletePage = async ({ pageId }: { pageId: string }) => {
    try {
      const page = findPage(nestedPages.value, pageId)
      await $api.nocoDocs.deletePage(pageId, { projectId: projectId! })

      if (page?.parent_page_id) {
        const parentPage = findPage(nestedPages.value, page.parent_page_id)
        if (!parentPage) return

        parentPage.children = parentPage.children?.filter((p) => p.id !== pageId)
        parentPage.isLeaf = parentPage.children?.length === 0
      } else {
        nestedPages.value = nestedPages.value.filter((p) => p.id !== pageId)
      }

      navigateTo(nestedUrl(page?.parent_page_id))
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  function nestedSlugsFromPageId(id: string | undefined) {
    if (!id) return []

    const page = findPage(nestedPages.value, id)!
    const slugs = []
    let parentPage = page
    while (parentPage?.parentNodeId) {
      slugs.unshift(parentPage!.slug!)
      parentPage = findPage(nestedPages.value, parentPage.parentNodeId)!
    }
    slugs.unshift(parentPage.slug!)

    return slugs
  }

  function projectUrl() {
    return isPublic.value ? `/nc/doc/${projectId!}/public` : `/nc/doc/${projectId!}`
  }

  function nestedUrl(id: string | undefined, { completeUrl = false, publicUrl = false } = {}) {
    const nestedSlugs = nestedSlugsFromPageId(id)
    const url =
      isPublic.value || publicUrl
        ? `/nc/doc/${projectId!}/public/${id}/${nestedSlugs.join('/')}`
        : `/nc/doc/${projectId!}/${id}/${nestedSlugs.join('/')}`
    return completeUrl ? `${window.location.origin}/#${url}` : url
  }

  const createMagic = async (title: string) => {
    try {
      await $api.nocoDocs.createNestedPagesMagic({
        projectId: projectId!,
        title,
      } as any)
    } catch (e) {
      message.warning('NocoAI failed for the demo reasons. Please try again.')
    }
  }

  const createImport = async (url: string, type: 'md' | 'nuxt' | 'docusaurus' = 'md', from: 'github' | 'file' = 'github') => {
    try {
      const rs = gh(url)
      await $api.nocoDocs.importPages({
        user: rs!.owner!,
        repo: rs!.name!,
        branch: rs!.branch!,
        path: rs!.path!.replace(`${rs?.repo}/tree/${rs?.branch}/`, ''),
        projectId: projectId!,
        type,
        from,
      } as any)
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const updatePage = async ({ pageId, page }: { pageId: string; page: Partial<PageSidebarNode> }) => {
    const updatedPage = await $api.nocoDocs.updatePage(pageId, {
      attributes: page as any,
      projectId: projectId!,
    })
    const foundPage = findPage(nestedPages.value, pageId)!
    if (page.title) {
      // todo: Update the page in a better way
      foundPage.slug = updatedPage.slug
      foundPage.title = updatedPage.title
      foundPage.updated_at = updatedPage.updated_at
      foundPage.last_updated_by_id = updatedPage.last_updated_by_id

      if (foundPage.new) foundPage.new = false

      await navigateTo(nestedUrl(updatedPage.id!))
    } else {
      Object.assign(foundPage, page)
    }
  }

  const updateContent = async ({ pageId, content }: { pageId: string; content: string }) => {
    try {
      await $api.nocoDocs.updatePage(pageId, {
        attributes: { content } as any,
        projectId: projectId!,
      })
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
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
    const sourceNode = findPage(nestedPages.value, sourceNodeId)!
    const targetNode = targetNodeId ? findPage(nestedPages.value, targetNodeId) : undefined

    const sourceParentNode = findPage(nestedPages.value, sourceNode.parent_page_id!)
    const sourceNodeSiblings = sourceParentNode ? sourceParentNode.children! : nestedPages.value

    sourceNodeSiblings.splice(
      sourceNodeSiblings.findIndex((node) => node.id === sourceNode.id),
      1,
    )
    if (sourceParentNode) sourceParentNode.isLeaf = sourceParentNode.children?.length === 0

    if (targetNode && !targetNode.children) targetNode.children = []

    const targetNodeSiblings = targetNode ? targetNode.children! : nestedPages.value

    sourceNode.parent_page_id = targetNode?.id
    sourceNode.parentNodeId = targetNode?.id
    targetNodeSiblings.splice(index, 0, sourceNode)

    const node = findPage(nestedPages.value, sourceNodeId)!
    await updatePage({ pageId: sourceNodeId, page: { order: index + 1, parent_page_id: targetNode?.id ?? null } as any })

    navigateTo(nestedUrl(node.id!))
    const openedPages = [...getPageWithParents(node), node]
    for (const page of openedPages) {
      if (!openedTabs.value.includes(page.id!)) {
        openedTabs.value.push(page.id!)
      }
    }
  }

  function getPageWithParents(page: PageSidebarNode) {
    const parents: PageSidebarNode[] = [page]
    let parent: PageSidebarNode | undefined = page
    while (parent.parent_page_id) {
      parent = findPage(nestedPages.value, parent.parent_page_id!)
      if (!parent) break

      parents.push(parent)
    }
    return parents
  }

  const getChildrenOfPage = (pageId?: string) => {
    if (!pageId) return nestedPages.value

    const page = findPage(nestedPages.value, pageId!)
    if (!page) return []

    return page.children || []
  }

  const openChildPageTabsOfRootPages = async () => {
    for (const page of nestedPages.value) {
      if (!page.is_parent) continue

      if (!openedTabs.value.includes(page.id!)) {
        openedTabs.value.push(page.id!)
      }
    }
  }

  const expandTabOfOpenedPage = () => {
    if (!openedPage.value) throw new Error('openedPage is not defined')

    const pagesWithParents = getPageWithParents(openedPage.value)
    for (const page of pagesWithParents) {
      if (!openedTabs.value.includes(page.id!)) {
        openedTabs.value.push(page.id!)
      }
    }
    openedTabs.value = [...openedTabs.value]
  }

  const openPage = async (page: PageSidebarNode) => {
    const url = nestedUrl(page.id!)

    await navigateTo(url)
  }

  const uploadFile = async (file: File) => {
    // todo: use a better id
    const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const data = await $api.storage.upload(
      {
        path: [NOCO, projectId, randomId].join('/'),
      },
      {
        files: file,
        json: '{}',
      },
    )

    return data[0]?.path ? `${appInfo.ncSiteUrl}/${data[0].path}` : ''
  }

  async function navigateToFirstPage() {
    const page = nestedPages.value[0]
    await navigateTo(nestedUrl(page.id!))
  }

  const magicExpand = async (text: string, pageId?: string) => {
    const id = pageId || openedPage.value!.id!
    const response = await $api.nocoDocs.magicExpandText({
      projectId: projectId!,
      pageId: id,
      text,
    })
    return response
  }

  const magicOutline = async (pageId?: string) => {
    const id = pageId || openedPage.value!.id!
    const response = await $api.nocoDocs.magicOutlinePage({
      projectId: projectId!,
      pageId: id,
    })
    return response
  }

  const getParentOfPage = (pageId: string) => {
    const page = findPage(nestedPages.value, pageId)
    if (!page) return undefined
    if (!page.parent_page_id) return undefined

    return findPage(nestedPages.value, page.parent_page_id)
  }

  function findPage(_nestedPages: PageSidebarNode[], pageId: string) {
    // traverse the tree and find the parent page
    const findPageInTree = (_pages: PageSidebarNode[], _pageId: string): PageSidebarNode | undefined => {
      if (!_pages) {
        console.error('nestedPages is undefined:', { _pageId, pageId, _pages })
      }
      for (const page of _pages) {
        if (page.id === _pageId) return page

        if (page.children) {
          const foundPage = findPageInTree(page.children, _pageId)
          if (foundPage) return foundPage
        }
      }
    }

    return findPageInTree(_nestedPages, pageId)
  }

  return {
    isPageErrored,
    isFetching,
    nestedPages,
    openedTabs,
    isErrored,
    routePageSlugs,
    flattenedNestedPages,
    openedPage,
    isNoPageOpen,
    openedPageId,
    fetchPage,
    openPage,
    openChildPageTabsOfRootPages,
    fetchNestedPages,
    createPage,
    updatePage,
    deletePage,
    addNewPage,
    createMagic,
    updateContent,
    getChildrenOfPage,
    createImport,
    reorderPages,
    uploadFile,
    navigateToFirstPage,
    magicExpand,
    magicOutline,
    getParentOfPage,
    nestedUrl,
    nestedSlugsFromPageId,
    projectUrl,
    expandTabOfOpenedPage,
    openedNestedPages,
  }
}, 'useDocs')

export default () => {
  const state = use()

  if (!state) {
    return setup()
  }

  return state
}
