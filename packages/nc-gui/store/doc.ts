import { defineStore } from 'pinia'
import type { DocsPageType } from 'nocodb-sdk'
import type { PageSidebarNode } from '~~/lib'

export const useDocStore = defineStore('docStore', () => {
  const route = useRoute()
  const { $api } = useNuxtApp()
  const { projectRoles } = useRoles()

  const isPublic = computed<boolean>(() => !!route.meta.public)

  const openedProjectId = computed<string>(() => route.params.projectId as string)
  const openedPageId = computed<string>(() => route.params.pageId as string)
  const openedWorkspaceId = computed<string>(() => route.params.workspaceId as string)

  const nestedPagesOfProjects = ref<Record<string, PageSidebarNode[]>>({})
  const isNestedPageFetching = ref<Record<string, boolean>>({})
  const openedTabsOfProjects = ref<Record<string, string[]>>({})

  const openedPage = ref<PageSidebarNode | undefined>(undefined)

  const isEditAllowed = computed<boolean>(
    () =>
      !isPublic.value &&
      !!(
        projectRoles.value[ProjectRole.Creator] ||
        projectRoles.value[ProjectRole.Owner] ||
        projectRoles.value[ProjectRole.Editor]
      ),
  )

  async function fetchNestedPages({ withoutLoading, projectId }: { projectId: string; withoutLoading?: boolean }) {
    if (!withoutLoading) isNestedPageFetching.value[projectId] = true
    try {
      const nestedDocTree = isPublic.value
        ? await $api.nocoDocs.listPublicPages({
            projectId: projectId!,
            // parent_page_id: openedPage.value!.nested_published_parent_id!,
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

      return nestedDocTree
    } catch (e) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    } finally {
      if (!withoutLoading) isNestedPageFetching.value[projectId] = false
    }
  }

  const openedPageInSidebar = computed(() => {
    if (!openedPageId.value) return undefined
    if (isNestedPageFetching.value[openedProjectId.value]) return undefined
    if (!nestedPagesOfProjects.value[openedProjectId.value]) return undefined

    return findPage(nestedPagesOfProjects.value[openedProjectId.value], openedPageId.value)
  })

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

  function projectUrl(projectId: string) {
    return isPublic.value ? `/nc/doc/${projectId!}/s` : `/ws/${openedWorkspaceId.value}/nc/${projectId}/doc`
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
    const openedTabs = openedTabsOfProjects.value[projectId]
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

  return {
    isPublic,
    openedPageInSidebar,
    nestedPagesOfProjects,
    fetchNestedPages,
    isNestedPageFetching,
    openedPageId,
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
  }
})
