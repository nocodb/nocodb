import { toRef } from 'vue'
import { defineStore } from 'pinia'
import type { DocsPageType } from 'nocodb-sdk'
import gh from 'parse-github-url'
import type { PageSidebarNode } from '~~/lib'

export const useDocStore = defineStore('docStore', () => {
  const router = useRouter()
  const route = router.currentRoute

  const { $api } = useNuxtApp()
  const globalStore = useGlobal()
  const appInfo = toRef(globalStore, 'appInfo')
  const { projectRoles } = useRoles()
  const { setProject } = useProject()

  const isNestedPageFetching = ref<Record<string, boolean>>({})
  const isPageFetching = ref<boolean>(false)
  const isPageErrored = ref<boolean>(false)
  const isNestedFetchErrored = ref<boolean>(false)

  const nestedPagesOfProjects = ref<Record<string, PageSidebarNode[]>>({})

  const openedPage = ref<PageSidebarNode | undefined>(undefined)

  /***
   *
   *
   * Computed
   *
   */

  const isPublic = computed<boolean>(() => !!route.value.meta.public)

  const openedProjectId = computed<string>(() =>
    isPublic.value
      ? projectIdFromCompositePageId(route.value.params.compositePageId as string)!
      : (route.value.params.projectId as string),
  )
  const openedPageId = computed<string | null>(() =>
    isPublic.value
      ? pageIdFromCompositePageId(route.value.params.compositePageId as string)
      : (route.value.params.pageId as string),
  )
  const openedWorkspaceId = computed<string>(() => route.value.params.workspaceId as string)

  const isOpenedNestedPageLoading = computed<boolean>(() => isNestedPageFetching.value[openedProjectId.value] ?? true)

  const isEditAllowed = computed<boolean>(() => {
    return (
      !isPublic.value &&
      !!(
        projectRoles.value[ProjectRole.Creator] ||
        projectRoles.value[ProjectRole.Owner] ||
        projectRoles.value[ProjectRole.Editor]
      )
    )
  })

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

    return openedPage.value?.nested_published_parent_id && nestedPages
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
    async () => {
      if (!openedPageId.value) {
        openedPage.value = undefined
        return
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

      if (isPublic.value) return
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

  async function populatedNestedPages({ projectId }: { projectId: string }) {
    if (!projectId) return

    if (nestedPagesOfProjects.value[projectId]) return

    await fetchNestedPages({ projectId })
  }

  async function fetchNestedPages({ withoutLoading, projectId }: { projectId: string; withoutLoading?: boolean }) {
    if (!withoutLoading) isNestedPageFetching.value[projectId] = true
    try {
      const nestedDocTree = isPublic.value
        ? await $api.nocoDocs.listPublicPages(projectId, openedPageId.value!)
        : await $api.nocoDocs.listPages(projectId!)

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

  async function fetchPage({
    page,
    projectId,
    doNotSetProject,
  }: {
    page?: PageSidebarNode
    projectId: string
    doNotSetProject?: boolean
  }) {
    const pageId = page?.id || openedPageId.value
    if (!pageId) throw new Error('No page id or slug provided')

    try {
      if (isPublic.value) {
        const response = await $api.nocoDocs.getPublicPageAndProject(projectId, pageId)
        if (!doNotSetProject) {
          setProject(response.project!)
        }

        return response.page
      }
      return await $api.nocoDocs.getPage(projectId, pageId)
    } catch (e) {
      console.log(e, !doNotSetProject)
      if (doNotSetProject) return undefined

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
    nodeOverrides?: Partial<PageSidebarNode>
    projectId: string
  }) {
    const { generateHTML } = await import('~/utils/tiptapExtensions/generateHTML')
    const { emptyDocContent } = await import('~~/utils/tiptapExtensions/helper')
    const { default: tiptapExts } = await import('~~/utils/tiptapExtensions')

    const nestedPages = nestedPagesOfProjects.value[projectId]
    openedPage.value = undefined
    isPageFetching.value = true

    page.content = JSON.stringify(emptyDocContent)
    page.content_html = generateHTML(emptyDocContent, tiptapExts)

    try {
      let createdPageData = await $api.nocoDocs.createPage(projectId, {
        attributes: page,
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

      // if (isPublic.value) return
      // const { addTab } = useTabs()

      // addTab({
      //   id: createdPageData.id!,
      //   title: createdPageData.title,
      //   type: TabType.DOCUMENT,
      //   projectId,
      // })
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    } finally {
      isPageFetching.value = false
    }
  }

  const addNewPage = async ({ parentPageId, projectId }: { parentPageId?: string; projectId: string }) => {
    await createPage({
      projectId,
      page: {
        title: '',
        parent_page_id: parentPageId,
        content: '',
      },
    })
  }

  async function deletePage({ pageId, projectId }: { pageId: string; projectId?: string }) {
    try {
      projectId = projectId ?? openedProjectId.value
      const nestedPages = nestedPagesOfProjects.value[projectId!]

      const page = findPage(nestedPages, pageId)
      await $api.nocoDocs.deletePage(projectId, pageId)

      const { closeTab } = useTabs()
      await closeTab({ id: pageId })

      let toBeRedirectedPageId: string | undefined
      if (page?.parent_page_id) {
        const parentPage = findPage(nestedPages, page.parent_page_id)
        if (!parentPage) return

        parentPage.children = parentPage.children?.filter((p) => p.id !== pageId)
        parentPage.isLeaf = parentPage.children?.length === 0
        toBeRedirectedPageId = page?.parent_page_id
      } else {
        nestedPagesOfProjects.value[projectId!] = nestedPages.filter((p) => p.id !== pageId)
        const updatedNestedPages = nestedPagesOfProjects.value[projectId!]

        if (updatedNestedPages.length === 0) return navigateTo(projectUrl(projectId))

        const siblingPage = updatedNestedPages[0]
        toBeRedirectedPageId = siblingPage.id!
      }

      // Don't redirect if the deleted page is not the opened page
      if (pageId !== openedPageId.value) return

      navigateTo(nestedUrl({ id: toBeRedirectedPageId, projectId }))
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

    const updatedPage = await $api.nocoDocs.updatePage(projectId, pageId, {
      attributes: page as any,
    })

    if (page.title) {
      // todo: Update the page in a better way
      foundPage.slug = updatedPage.slug
      foundPage.updated_at = updatedPage.updated_at
      foundPage.last_updated_by_id = updatedPage.last_updated_by_id

      await navigateTo(nestedUrl({ projectId, id: updatedPage.id! }))
    } else if (!disableLocalSync) {
      Object.assign(foundPage, page)
    }

    if ('is_published' in page || 'parent_page_id' in page) {
      Object.assign(openedPage.value!, updatedPage)

      const pageInNestedPages = findPage(nestedPages, pageId)
      if (pageInNestedPages) {
        pageInNestedPages.is_published = updatedPage.is_published
        pageInNestedPages.parent_page_id = updatedPage.parent_page_id
        pageInNestedPages.updated_at = updatedPage.updated_at
        pageInNestedPages.last_updated_by_id = updatedPage.last_updated_by_id
        pageInNestedPages.nested_published_parent_id = updatedPage.nested_published_parent_id
      }

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

  function getChildrenOfPage({ pageId, projectId }: { pageId?: string; projectId: string }) {
    const nestedPages = nestedPagesOfProjects.value[projectId]
    if (!pageId) return nestedPages

    const page = findPage(nestedPages, pageId!)
    if (!page) return []

    return page.children || []
  }

  function getAllChildrenOfPage({ pageId, projectId }: { pageId?: string; projectId: string }) {
    if (!pageId) return []
    const nestedPages = nestedPagesOfProjects.value[projectId]

    const page = findPage(nestedPages, pageId!)
    if (!page) return []

    let children: PageSidebarNode[] = []
    for (const child of page.children || []) {
      children.push(child)
      children = children.concat(getAllChildrenOfPage({ pageId: child.id, projectId }))
    }

    return children
  }

  const createPagesGpt = async ({ text, projectId }: { text: string; projectId: string }) => {
    try {
      await $api.nocoDocs.docsGpt(projectId, {
        text,
      })
    } catch (e) {
      message.warning('Something went wrong')
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
      await $api.nocoDocs.importPages(projectId, {
        user: rs!.owner!,
        repo: rs!.name!,
        branch: rs!.branch!,
        path: rs!.path!.replace(`${rs?.repo}/tree/${rs?.branch}/`, ''),
        type,
        from,
      })
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const openPage = async ({ page, projectId }: { page: PageSidebarNode; projectId: string }) => {
    const url = nestedUrl({ id: page.id!, projectId })

    isPageFetching.value = true
    await navigateTo(url)
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

  const gptPageExpand = async ({ projectId, text, pageId }: { text: string; pageId?: string; projectId: string }) => {
    const id = pageId || openedPageInSidebar.value!.id!
    const response = await $api.nocoDocs.docsPageGpt(
      projectId,
      id,
      {
        type: 'expand',
      },
      {
        text,
      },
    )
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

    return data[0]?.path ? `${appInfo.value.ncSiteUrl}/${data[0].path}` : ''
  }

  // todo: Temp
  const loadPublicPageAndProject = async () => {
    if (!openedPageId.value) throw new Error('openedPageId is not defined')

    const projectId = route.value.params.projectId as string

    isPageFetching.value = true
    try {
      const response = await $api.nocoDocs.getPublicPageAndProject(projectId, openedPageId.value!)

      openedPage.value = response.page as any
      // project.value = response.project as any
    } catch (error) {
      console.error(error)
      isPageErrored.value = true
    } finally {
      isPageFetching.value = false
    }
  }

  const gptPageOutline = async ({ pageId, projectId }: { pageId?: string; projectId: string }) => {
    const id = pageId || openedPageInSidebar.value!.id!
    const response = await $api.nocoDocs.docsPageGpt(
      projectId,
      id,
      {
        type: 'outline',
      },
      {
        text: '',
      },
    )
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

    if (isPublic.value) return
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
    deletePage,
    projectUrl,
    reorderPages,
    fetchPage,
    updatePage,
    addNewPage,
    createPage,
    isEditAllowed,
    getPageWithParents,
    getChildrenOfPage,
    createPagesGpt,
    createImport,
    openPage,
    isPageFetching,
    openedPageWithParents,
    openedPage,
    nestedPublicParentPage,
    getParentOfPage,
    flattenedNestedPages,
    nestedSlugsFromPageId,
    gptPageExpand,
    uploadFile,
    loadPublicPageAndProject,
    isNestedPublicPage,
    isOpenedNestedPageLoading,
    gptPageOutline,
    navigateToFirstPage,
    isNestedFetchErrored,
    isPageErrored,
    populatedNestedPages,
    getAllChildrenOfPage,
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
