import { message } from 'ant-design-vue'
import type { DocsPageType } from 'nocodb-sdk'
import gh from 'parse-github-url'
import { extractSdkResponseErrorMsg, useNuxtApp } from '#imports'
import type { PageSidebarNode } from '~~/lib'
import { ProjectRole } from '~/lib/enums'

export const PAGES_PER_PAGE_LIST = 10

const [setup, use] = useInjectionState(() => {
  const route = useRoute()
  const { $api } = useNuxtApp()
  const { appInfo } = $(useGlobal())
  const { projectRoles } = useRoles()
  const { project } = useProject()

  const isPublic = computed<boolean>(() => !!route.meta.public)
  const isEditAllowed = computed<boolean>(
    () =>
      !isPublic.value &&
      !!(
        projectRoles.value[ProjectRole.Creator] ||
        projectRoles.value[ProjectRole.Owner] ||
        projectRoles.value[ProjectRole.Editor]
      ),
  )

  const projectId = $(
    computed(() => {
      const pageId = route.params.pageId as string
      if (!pageId) return undefined

      const idSplits = pageId?.split('-')
      if (idSplits.length === 0) return undefined

      return idSplits[idSplits.length - 1]
    }),
  )

  const openedPageId = computed(() => {
    const pageId = route.params.pageId as string
    if (!pageId) return undefined

    const idSplits = pageId.split('-')
    if (idSplits.length < 2) return undefined

    return pageId.split('-')[pageId.split('-').length - 2]
  })
  const workspaceId = $(computed(() => route.params.workspaceId as string))

  const isPageErrored = ref<boolean>(false)

  const isFetching = ref({
    nestedPages: true,
    page: true,
  })

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

  const openedTabs = ref<string[]>([])

  const openedPage = ref<PageSidebarNode | undefined>(undefined)

  const isNestedPublicPage = computed<boolean>(
    () =>
      !!(
        openedPage.value?.is_published &&
        openedPage.value?.nested_published_parent_id &&
        openedPage.value?.nested_published_parent_id !== openedPage.value.id
      ) ||
      !!(
        openedPage.value?.is_published &&
        openedPage.value?.nested_published_parent_id === openedPage.value.id &&
        openedPage.value.is_parent
      ),
  )

  // Pages tree used in sidebar
  const nestedPages = ref<PageSidebarNode[]>([])

  // Opened page in `nestedPages` tree used in sidebar
  const openedPageInSidebar = computed(() => {
    if (!openedPageId.value) return undefined
    if (isFetching.value.nestedPages) return undefined

    return findPage(nestedPages.value, openedPageId.value)
  })

  const nestedPublicParentPage = computed<PageSidebarNode | undefined>(() =>
    openedPage.value?.nested_published_parent_id
      ? findPage(nestedPages.value, openedPage.value?.nested_published_parent_id)
      : undefined,
  )

  watch(
    openedPageId,
    async (_, oldId) => {
      if (!openedPageId.value) {
        openedPage.value = undefined
        return
      }

      // if the page is new, don't fetch it
      if (openedPage.value?.new && openedPage.value.id === openedPageId.value) return

      if (oldId) {
        const page = findPage(nestedPages.value, oldId)
        if (page?.new) {
          page.new = false
        }
      }

      isFetching.value.page = true
      openedPage.value = undefined

      const newPage = (await fetchPage()) as any
      if (newPage?.id !== openedPageId.value) return

      openedPage.value = newPage

      isFetching.value.page = false
    },
    {
      immediate: true,
    },
  )

  // Sync opened page in sidebar with opened page
  watch(
    openedPageInSidebar,
    () => {
      if (!openedPage.value) return
      if (isPublic.value) return
      if (openedPage.value?.new) return

      openedPage.value = {
        ...openedPage.value,
        ...openedPageInSidebar.value,
      } as PageSidebarNode
    },
    {
      deep: true,
    },
  )

  // Sync opened page title and icon with sidebar
  watch(
    openedPage,
    () => {
      if (isPublic.value) return

      if (!openedPageInSidebar.value?.id) return
      if (!openedPage.value) return
      if (openedPage.value?.id !== openedPageInSidebar.value?.id) return

      const page = findPage(nestedPages.value, openedPageInSidebar.value.id)
      if (!page) return

      page.title = openedPage.value.title
      page.icon = openedPage.value.icon
    },
    {
      deep: true,
    },
  )

  // verify if the levels of nested pages are correct
  // if not, set the correct level
  watch(
    nestedPages,
    () => {
      if (nestedPages.value.length === 0) return

      let isTreeCorrect = true
      const verifyLevelAndIsLeaf = (tree: PageSidebarNode[], level: number) => {
        tree.forEach((node) => {
          if (node.level !== level) {
            isTreeCorrect = false
          }

          if (node.isLeaf === false && node.children && node.children.length > 0) {
            isTreeCorrect = false
          }

          if (node.children && node.children.length === 0 && node.isLeaf !== true) {
            isTreeCorrect = false
          }

          if (node.children) {
            verifyLevelAndIsLeaf(node.children, level + 1)
          }
        })
      }

      verifyLevelAndIsLeaf(nestedPages.value, 0)

      if (isTreeCorrect) return

      const traverse = (tree: PageSidebarNode[], level: number) => {
        tree.forEach((node) => {
          node.level = level
          if (node.children && node.children.length > 0) {
            traverse(node.children, level + 1)
            node.isLeaf = false
          } else {
            node.isLeaf = true
          }
        })
      }

      traverse(nestedPages.value, 0)
    },
    {
      deep: true,
    },
  )

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

  const openedPageWithParents = computed(() => (openedPageInSidebar.value ? getPageWithParents(openedPageInSidebar.value) : []))

  async function fetchNestedPages({ withoutLoading }: { withoutLoading?: boolean } = {}) {
    if (!withoutLoading) isFetching.value.nestedPages = true
    try {
      const nestedDocTree = isPublic.value
        ? await $api.nocoDocs.listPublicPages({
            projectId: projectId!,
            parent_page_id: openedPage.value!.nested_published_parent_id!,
          })
        : await $api.nocoDocs.listPages({
            projectId: projectId!,
          })

      // traverse tree and add `isLeaf` and `key` properties
      const traverse = (parentNode: any, pages: PageSidebarNode[], level: number) => {
        pages.forEach((p) => {
          p.isLeaf = !p.is_parent
          p.key = p.id!
          p.parentNodeId = parentNode?.id
          p.level = level

          if (p.children) traverse(p, p.children, level + 1)
        })
      }

      traverse(undefined, nestedDocTree as any, 0)

      nestedPages.value = nestedDocTree as any

      return nestedDocTree
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    } finally {
      if (!withoutLoading) isFetching.value.nestedPages = false
    }
  }

  async function fetchPage({ page }: { page?: PageSidebarNode } = {}) {
    const pageId = page?.id || openedPageId.value
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
          level: Number(parentPage.level) + 1,
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

      openedPage.value = findPage(nestedPages.value, createdPageData.id!)
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

    isFetching.value.page = true
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
    isFetching.value.page = false
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
        navigateTo(nestedUrl(page?.parent_page_id))
      } else {
        nestedPages.value = nestedPages.value.filter((p) => p.id !== pageId)
        if (nestedPages.value.length === 0) return navigateTo(projectUrl())

        const siblingPage = nestedPages.value[0]
        navigateTo(nestedUrl(siblingPage.id))
      }
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
    return isPublic.value ? `/nc/doc/${projectId!}/s` : `/nc/doc/${projectId!}`
  }

  function nestedUrl(id: string | undefined, { completeUrl = false, publicUrl = false } = {}) {
    id = id ?? openedPageId.value!
    const slug = findPage(nestedPages.value, id)?.slug ?? ''

    const publicMode = isPublic.value || publicUrl
    let url: string
    if (publicMode) url = `/ws/${workspaceId}/nc/${projectId}/doc/s/${id}/${nestedSlugs.join('/')}`
    if (publicMode) {
      url = `/nc/doc/s/${slug}-${id}-${projectId}`
    } else {
      url = `/ws/${workspaceId}/nc/${projectId}/doc/p/${id}/${nestedSlugs.join('/')}`
      // url = `/nc/doc/p/${slug}-${id}-${projectId}`
    }

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

  const updatePage = async ({
    pageId,
    page,
    disableLocalSync,
  }: {
    pageId: string
    page: Partial<PageSidebarNode>
    disableLocalSync?: boolean
  }) => {
    const foundPage = findPage(nestedPages.value, pageId)!
    if (page.title) foundPage.title = page.title
    if (page?.title?.length === 0) page.title = foundPage.title

    const updatedPage = await $api.nocoDocs.updatePage(pageId, {
      attributes: page as any,
      projectId: projectId!,
    })

    if (page.title) {
      // todo: Update the page in a better way
      foundPage.slug = updatedPage.slug
      foundPage.updated_at = updatedPage.updated_at
      foundPage.last_updated_by_id = updatedPage.last_updated_by_id

      if (foundPage.new) foundPage.new = false

      await navigateTo(nestedUrl(updatedPage.id!))
    } else if (!disableLocalSync) {
      Object.assign(foundPage, page)
    }

    if ('is_published' in page || 'parent_page_id' in page) {
      openedPage.value = { ...updatedPage, ...openedPage.value } as any

      await fetchNestedPages({
        withoutLoading: true,
      })
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

  function getPageWithParents(page: PageSidebarNode): PageSidebarNode[] {
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
    if (!openedPageInSidebar.value) throw new Error('openedPage is not defined')

    const pagesWithParents = getPageWithParents(openedPageInSidebar.value)
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
        files: file as any,
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
    const id = pageId || openedPageInSidebar.value!.id!
    const response = await $api.nocoDocs.magicExpandText({
      projectId: projectId!,
      pageId: id,
      text,
    })
    return response
  }

  const magicOutline = async (pageId?: string) => {
    const id = pageId || openedPageInSidebar.value!.id!
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

  const loadPublicPageAndProject = async () => {
    if (!openedPageId.value) throw new Error('openedPageId is not defined')

    isFetching.value.page = true
    try {
      const response = await $api.nocoDocs.getPublicPage(openedPageId.value!, {
        projectId: projectId!,
      })

      openedPage.value = response.page as any
      project.value = response.project as any
    } catch (error) {
      console.error(error)
      isPageErrored.value = true
    } finally {
      isFetching.value.page = false
    }
  }

  return {
    isPageErrored,
    isFetching,
    nestedPages,
    openedTabs,
    isErrored,
    routePageSlugs,
    flattenedNestedPages,
    openedPageInSidebar,
    openedPage,
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
    openedPageWithParents,
    isPublic,
    getPageWithParents,
    findPage,
    isEditAllowed,
    projectId,
    loadPublicPageAndProject,
    nestedPublicParentPage,
    isNestedPublicPage,
  }
}, 'useDocs')

export default () => {
  const state = use()

  if (!state) {
    return setup()
  }

  return state
}
