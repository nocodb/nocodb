import { defineStore } from 'pinia'
import type { DocsPageType } from 'nocodb-sdk'
import gh from 'parse-github-url'
import type { PageSidebarNode } from '~~/lib'

export const useDocStore = defineStore('docStore', () => {
  const router = useRouter()
  const route = $(router.currentRoute)

  const { $api } = useNuxtApp()
  const { appInfo } = $(useGlobal())
  const { projectRoles } = useRoles()

  const isNestedPageFetching = ref<Record<string, boolean>>({})
  const isPageFetching = ref<boolean>(true)
  const isPageErrored = ref<boolean>(false)
  const isNestedFetchErrored = ref<boolean>(false)

  const nestedPagesOfProjects = ref<Record<string, PageSidebarNode[]>>({})
  const openedTabsOfProjects = ref<Record<string, string[]>>({})

  const openedPage = ref<PageSidebarNode | undefined>(undefined)

  /***
   *
   *
   * Computed
   *
   */

  const isPublic = computed<boolean>(() => !!route.meta.public)
  const openedProjectId = computed<string>(() =>
    isPublic.value ? projectIdFromCompositePageId(route.params.compositePageId as string)! : (route.params.projectId as string),
  )
  const openedPageId = computed<string | null>(() =>
    isPublic.value ? pageIdFromCompositePageId(route.params.compositePageId as string) : (route.params.pageId as string),
  )
  const openedWorkspaceId = computed<string>(() => route.params.workspaceId as string)

  const isOpenedNestedPageLoading = computed<boolean>(() => isNestedPageFetching.value[openedProjectId.value] ?? true)

  const isEditAllowed = computed<boolean>(
    () =>
      !isPublic.value &&
      !!(
        projectRoles.value[ProjectRole.Creator] ||
        projectRoles.value[ProjectRole.Owner] ||
        projectRoles.value[ProjectRole.Editor]
      ),
  )

  const nestedPagesOfOpenedProject = computed<PageSidebarNode[]>(() => nestedPagesOfProjects.value[openedProjectId.value] || [])

  const openedPageInSidebar = computed(() => {
    if (!openedPageId.value) return undefined
    if (isNestedPageFetching.value[openedProjectId.value]) return undefined
    if (!nestedPagesOfProjects.value[openedProjectId.value]) return undefined

    return findPage(nestedPagesOfProjects.value[openedProjectId.value], openedPageId.value)
  })

  const openedPageWithParents = computed(() =>
    openedPageInSidebar.value ? getPageWithParents({ page: openedPageInSidebar.value, projectId: openedProjectId.value }) : [],
  )

  const nestedPublicParentPage = computed<PageSidebarNode | undefined>(() => {
    const nestedPages = nestedPagesOfProjects.value[openedProjectId.value]

    return openedPage.value?.nested_published_parent_id
      ? findPage(nestedPages, openedPage.value?.nested_published_parent_id)
      : undefined
  })

  const flattenedNestedPages = computed(() => {
    if (!openedProjectId.value) return []

    const nestedPages = nestedPagesOfProjects.value[openedProjectId.value!]
    if (!nestedPages) return []
    if (nestedPages.length === 0) return []

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

    return flatten(nestedPages)
  })

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

  /***
   *
   *
   *
   * Watchers
   *
   *
   */

  watch(
    openedPageId,
    async (_, oldId) => {
      if (!openedPageId.value) {
        openedPage.value = undefined
        return
      }

      // if the page is new, don't fetch it
      if (openedPage.value?.new && openedPage.value.id === openedPageId.value) return

      const nestedPages = nestedPagesOfProjects.value[openedProjectId.value]

      if (oldId) {
        const page = findPage(nestedPages, oldId)
        if (page?.new) {
          page.new = false
        }
      }

      isPageFetching.value = true
      openedPage.value = undefined

      const newPage = (await fetchPage({
        projectId: openedProjectId.value,
      })) as any

      if (newPage?.id !== openedPageId.value) {
        isPageFetching.value = false
        return
      }

      openedPage.value = newPage

      addTabWhenNestedPagesIsPopulated({
        projectId: openedProjectId.value,
      })

      isPageFetching.value = false
    },
    {
      immediate: true,
      deep: true,
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

      const nestedPages = nestedPagesOfProjects.value[openedProjectId.value]

      const page = findPage(nestedPages, openedPageInSidebar.value.id)
      if (!page) return

      page.title = openedPage.value.title
      page.icon = openedPage.value.icon

      const { updateTab } = useTabs()

      updateTab(
        { id: page.id! },
        {
          title: openedPage.value.title,
          meta: {
            icon: openedPage.value.icon,
          },
        },
      )
    },
    {
      deep: true,
    },
  )

  // verify if the levels of nested pages are correct
  // if not, set the correct level
  watch(
    nestedPagesOfOpenedProject,
    () => {
      if (nestedPagesOfOpenedProject.value.length === 0) return

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

      verifyLevelAndIsLeaf(nestedPagesOfOpenedProject.value, 0)

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

      traverse(nestedPagesOfOpenedProject.value, 0)
    },
    {
      deep: true,
    },
  )

  /***
   *
   *
   *
   * Actions
   *
   *
   *
   */

  async function fetchNestedPages({ withoutLoading, projectId }: { projectId: string; withoutLoading?: boolean }) {
    if (!withoutLoading) isNestedPageFetching.value[projectId] = true
    try {
      const nestedDocTree = isPublic.value
        ? await $api.nocoDocs.listPublicPages({
            projectId: projectId!,
            parent_page_id: openedPageId.value!,
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

      nestedPagesOfProjects.value[projectId] = nestedDocTree as any
      openedTabsOfProjects.value[projectId] = flattenedNestedPages.value.map((p) => p.id) as any

      return nestedDocTree
    } catch (e) {
      console.log(e)
      isNestedFetchErrored.value = true
      message.error(await extractSdkResponseErrorMsg(e as any))
    } finally {
      if (!withoutLoading) isNestedPageFetching.value[projectId] = false
    }
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

  function nestedUrl({
    projectId,
    id,
    completeUrl,
    publicUrl,
  }: {
    projectId: string
    id: string
    completeUrl?: boolean
    publicUrl?: boolean
  }) {
    projectId = projectId || openedProjectId.value
    const nestedPages = nestedPagesOfProjects.value[projectId]

    const slug = findPage(nestedPages, id)?.slug ?? ''

    const publicMode = isPublic.value || publicUrl
    let url: string
    if (publicMode) {
      url = `/nc/doc/s/${slug}-${id}-${projectId}`
    } else {
      url = `/ws/${openedWorkspaceId.value}/nc/${projectId}/doc/${id}`
    }

    return completeUrl ? `${window.location.origin}/#${url}` : url
  }

  function projectUrl(projectId: string, { completeUrl, publicMode }: { completeUrl?: boolean; publicMode?: boolean } = {}) {
    const path = publicMode || isPublic.value ? `/nc/doc/s/${projectId!}` : `/ws/${openedWorkspaceId.value}/nc/${projectId}/doc`
    if (completeUrl) return `${window.location.origin}/#${path}`

    return path
  }

  async function fetchPage({ page, projectId }: { page?: PageSidebarNode; projectId: string }) {
    const pageId = page?.id || openedPageId.value
    if (!pageId) throw new Error('No page id or slug provided')

    try {
      return isPublic.value
        ? (
            await $api.nocoDocs.getPublicPage(pageId, {
              projectId: projectId!,
            })
          ).page
        : await $api.nocoDocs.getPage(pageId, {
            projectId: projectId!,
          })
    } catch (e) {
      console.log(e)
      isPageErrored.value = true
      return undefined
    }
  }

  async function createPage({
    page,
    nodeOverrides,
    projectId,
  }: {
    page: DocsPageType
    nodeOverrides?: Record<string, any>
    projectId: string
  }) {
    const nestedPages = nestedPagesOfProjects.value[projectId]

    try {
      let createdPageData = await $api.nocoDocs.createPage({
        attributes: page,
        projectId: projectId!,
      })

      if (nodeOverrides) createdPageData = { ...createdPageData, ...nodeOverrides }

      if (page.parent_page_id) {
        const parentPage = findPage(nestedPages, page.parent_page_id)
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
        nestedPages.push({
          ...createdPageData,
          isLeaf: !createdPageData.is_parent,
          key: createdPageData.id!,
          parentNodeId: undefined,
          children: [],
        })
      }

      openedPage.value = findPage(nestedPages, createdPageData.id!)
      await navigateTo(nestedUrl({ id: createdPageData.id!, projectId: projectId! }))

      const openedTabs = openedTabsOfProjects.value[projectId]
      if (!openedTabs.includes(createdPageData.id!)) {
        openedTabs.push(createdPageData.id!)
      }

      const { addTab } = useTabs()

      addTab({
        id: createdPageData.id!,
        title: createdPageData.title,
        type: TabType.DOCUMENT,
        projectId,
      })
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const addNewPage = async ({ parentPageId, projectId }: { parentPageId?: string; projectId: string }) => {
    const nestedPages = nestedPagesOfProjects.value[projectId]
    let dummyTitle = 'Page'
    let conflictCount = 0
    const parentPage = parentPageId && findPage(nestedPages, parentPageId)
    const _pages = parentPage ? parentPage.children : nestedPages

    while (_pages?.find((page) => page.title === dummyTitle)) {
      conflictCount++
      dummyTitle = `Page ${conflictCount}`
    }

    await createPage({
      projectId,
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

  async function deletePage({ pageId, projectId }: { pageId: string; projectId?: string }) {
    try {
      projectId = projectId ?? openedProjectId.value
      const nestedPages = nestedPagesOfProjects.value[projectId!]

      const page = findPage(nestedPages, pageId)
      await $api.nocoDocs.deletePage(pageId, { projectId: projectId! })

      if (page?.parent_page_id) {
        const parentPage = findPage(nestedPages, page.parent_page_id)
        if (!parentPage) return

        parentPage.children = parentPage.children?.filter((p) => p.id !== pageId)
        parentPage.isLeaf = parentPage.children?.length === 0
        navigateTo(nestedUrl({ id: page?.parent_page_id, projectId }))
      } else {
        nestedPagesOfProjects.value[projectId!] = nestedPages.filter((p) => p.id !== pageId)
        const updatedNestedPages = nestedPagesOfProjects.value[projectId!]

        if (updatedNestedPages.length === 0) return navigateTo(projectUrl(projectId))

        const siblingPage = updatedNestedPages[0]
        navigateTo(nestedUrl({ id: siblingPage.id!, projectId }))
      }

      const { closeTab } = useTabs()
      closeTab({ id: pageId })
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  async function updatePage({
    projectId,
    pageId,
    page,
    disableLocalSync,
  }: {
    projectId: string
    pageId: string
    page: Partial<PageSidebarNode>
    disableLocalSync?: boolean
  }) {
    const nestedPages = nestedPagesOfProjects.value[projectId!]

    const foundPage = findPage(nestedPages, pageId)!
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

      await navigateTo(nestedUrl({ projectId, id: updatedPage.id! }))
    } else if (!disableLocalSync) {
      Object.assign(foundPage, page)
    }

    if ('is_published' in page || 'parent_page_id' in page) {
      openedPage.value = { ...updatedPage, ...openedPage.value } as any

      await fetchNestedPages({
        projectId,
        withoutLoading: true,
      })
    }
  }

  async function reorderPages({
    sourceNodeId,
    targetNodeId,
    index,
    projectId,
  }: {
    sourceNodeId: string
    targetNodeId?: string
    index: number
    projectId: string
  }) {
    const nestedPages = nestedPagesOfProjects.value[projectId]

    const sourceNode = findPage(nestedPages, sourceNodeId)!
    const targetNode = targetNodeId ? findPage(nestedPages, targetNodeId) : undefined

    const sourceParentNode = findPage(nestedPages, sourceNode.parent_page_id!)
    const sourceNodeSiblings = sourceParentNode ? sourceParentNode.children! : nestedPages

    sourceNodeSiblings.splice(
      sourceNodeSiblings.findIndex((node) => node.id === sourceNode.id),
      1,
    )
    if (sourceParentNode) sourceParentNode.isLeaf = sourceParentNode.children?.length === 0

    if (targetNode && !targetNode.children) targetNode.children = []

    const targetNodeSiblings = targetNode ? targetNode.children! : nestedPages

    sourceNode.parent_page_id = targetNode?.id
    sourceNode.parentNodeId = targetNode?.id
    targetNodeSiblings.splice(index, 0, sourceNode)

    const node = findPage(nestedPages, sourceNodeId)!
    await updatePage({
      pageId: sourceNodeId,
      page: { order: index + 1, parent_page_id: targetNode?.id ?? null } as any,
      projectId,
    })

    navigateTo(nestedUrl({ id: node.id!, projectId }))
    const openedPages = [...getPageWithParents({ page: node, projectId }), node]
    const openedTabs = openedTabsOfProjects.value[projectId]

    for (const page of openedPages) {
      if (!openedTabs.includes(page.id!)) {
        openedTabs.push(page.id!)
      }
    }
  }

  function getPageWithParents({ page, projectId }: { page: PageSidebarNode; projectId: string }): PageSidebarNode[] {
    const nestedPages = nestedPagesOfProjects.value[projectId]
    if (!nestedPages) return []

    const parents: PageSidebarNode[] = [page]
    let parent: PageSidebarNode | undefined = page
    while (parent.parent_page_id) {
      parent = findPage(nestedPages, parent.parent_page_id!)
      if (!parent) break

      parents.push(parent)
    }
    return parents
  }

  function expandTabOfOpenedPage({ projectId }: { projectId: string }) {
    if (!openedPageInSidebar.value) throw new Error('openedPage is not defined')

    const pagesWithParents = getPageWithParents({ page: openedPageInSidebar.value, projectId })
    const openedTabs = openedTabsOfProjects.value[projectId] || []

    for (const page of pagesWithParents) {
      if (!openedTabs.includes(page.id!)) {
        openedTabs.push(page.id!)
      }
    }
    openedTabsOfProjects.value[projectId] = [...openedTabs]
  }

  function getChildrenOfPage({ pageId, projectId }: { pageId?: string; projectId: string }) {
    const nestedPages = nestedPagesOfProjects.value[projectId]
    if (!pageId) return nestedPages

    const page = findPage(nestedPages, pageId!)
    if (!page) return []

    return page.children || []
  }

  const createMagic = async ({ title, projectId }: { title: string; projectId: string }) => {
    try {
      await $api.nocoDocs.createNestedPagesMagic({
        projectId: projectId!,
        title,
      } as any)
    } catch (e) {
      message.warning('NocoAI failed for the demo reasons. Please try again.')
    }
  }

  const createImport = async (
    projectId: string,
    url: string,
    type: 'md' | 'nuxt' | 'docusaurus' = 'md',
    from: 'github' | 'file' = 'github',
  ) => {
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

  const openPage = async ({ page, projectId }: { page: PageSidebarNode; projectId: string }) => {
    const url = nestedUrl({ id: page.id!, projectId })

    await navigateTo(url)
  }

  const openChildPageTabsOfRootPages = async ({ projectId }: { projectId: string }) => {
    const nestedPages = nestedPagesOfProjects.value[projectId]
    const openedTabs = openedTabsOfProjects.value[projectId]

    for (const page of nestedPages) {
      if (!page.is_parent) continue

      if (!openedTabs.includes(page.id!)) {
        openedTabs.push(page.id!)
      }
    }
  }

  const getParentOfPage = ({ pageId, projectId }: { pageId: string; projectId: string }) => {
    const nestedPages = nestedPagesOfProjects.value[projectId]

    const page = findPage(nestedPages, pageId)
    if (!page) return undefined
    if (!page.parent_page_id) return undefined

    return findPage(nestedPages, page.parent_page_id)
  }

  function nestedSlugsFromPageId({ projectId, id }: { id: string; projectId: string }) {
    const nestedPages = nestedPagesOfProjects.value[projectId]

    const page = findPage(nestedPages, id)!
    const slugs = []
    let parentPage = page
    while (parentPage?.parentNodeId) {
      slugs.unshift(parentPage!.slug!)
      parentPage = findPage(nestedPages, parentPage.parentNodeId)!
    }
    slugs.unshift(parentPage.slug!)

    return slugs
  }

  const magicExpand = async ({ projectId, text, pageId }: { text: string; pageId?: string; projectId: string }) => {
    const id = pageId || openedPageInSidebar.value!.id!
    const response = await $api.nocoDocs.magicExpandText({
      projectId: projectId!,
      pageId: id,
      text,
    })
    return response
  }

  const uploadFile = async (file: File) => {
    // todo: use a better id
    const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const data = await $api.storage.upload(
      {
        path: [NOCO, openedProjectId.value, randomId].join('/'),
      },
      {
        files: file as any,
        json: '{}',
      } as any,
    )

    if (data[0]?.url) return data[0].url

    return data[0]?.path ? `${appInfo.ncSiteUrl}/${data[0].path}` : ''
  }

  // todo: Temp
  const loadPublicPageAndProject = async () => {
    if (!openedPageId.value) throw new Error('openedPageId is not defined')

    const projectId = route.params.projectId as string

    isPageFetching.value = true
    try {
      const response = await $api.nocoDocs.getPublicPage(openedPageId.value!, {
        projectId,
      })

      openedPage.value = response.page as any
      // project.value = response.project as any
    } catch (error) {
      console.error(error)
      isPageErrored.value = true
    } finally {
      isPageFetching.value = false
    }
  }

  const magicOutline = async ({ pageId, projectId }: { pageId?: string; projectId: string }) => {
    const id = pageId || openedPageInSidebar.value!.id!
    const response = await $api.nocoDocs.magicOutlinePage({
      projectId: projectId!,
      pageId: id,
    })
    return response
  }

  async function navigateToFirstPage({ projectId }: { projectId?: string } = {}) {
    projectId = projectId || openedProjectId.value
    const nestedPages = nestedPagesOfProjects.value[projectId]

    const page = nestedPages[0]

    if (!page) return

    await navigateTo(nestedUrl({ id: page.id!, projectId: projectId! }))
  }

  async function addTabWhenNestedPagesIsPopulated({ projectId }: { projectId: string }) {
    const nestedPages = nestedPagesOfProjects.value[projectId]
    if (!nestedPages) {
      setTimeout(() => {
        addTabWhenNestedPagesIsPopulated({ projectId })
      }, 100)
      return
    }

    if (!openedPageId.value) return

    const { addTab } = useTabs()

    addTab({
      id: openedPage.value!.id!,
      title: openedPage.value!.title,
      type: TabType.DOCUMENT,
      projectId: openedProjectId.value,
      meta: {
        icon: openedPage.value!.icon,
      },
    })
  }

  return {
    isPublic,
    openedPageInSidebar,
    nestedPagesOfProjects,
    fetchNestedPages,
    isNestedPageFetching,
    openedPageId,
    openedProjectId,
    nestedUrl,
    openedTabsOfProjects,
    deletePage,
    projectUrl,
    reorderPages,
    updatePage,
    addNewPage,
    createPage,
    isEditAllowed,
    expandTabOfOpenedPage,
    getChildrenOfPage,
    createMagic,
    createImport,
    openPage,
    openChildPageTabsOfRootPages,
    isPageFetching,
    openedPageWithParents,
    openedPage,
    nestedPublicParentPage,
    getParentOfPage,
    flattenedNestedPages,
    nestedSlugsFromPageId,
    magicExpand,
    uploadFile,
    loadPublicPageAndProject,
    isNestedPublicPage,
    isOpenedNestedPageLoading,
    magicOutline,
    navigateToFirstPage,
    isNestedFetchErrored,
    isPageErrored,
  }
})

function pageIdFromCompositePageId(compositePageId: string) {
  const ids = compositePageId.split('-')
  if (ids.length < 3) return null

  return ids[ids.length - 2]
}

function projectIdFromCompositePageId(compositePageId: string) {
  const ids = compositePageId.split('-')
  if (ids.length < 1) return null

  return ids[ids.length - 1]
}
