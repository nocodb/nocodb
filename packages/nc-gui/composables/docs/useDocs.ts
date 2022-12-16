import { message } from 'ant-design-vue'
import type { DocsPageType } from 'nocodb-sdk'
import gh from 'parse-github-url'
import { extractSdkResponseErrorMsg, useNuxtApp, useState } from '#imports'

export interface DocsPage extends DocsPageType {
  children?: DocsPage[]
  parentPageSlug?: string
  isLeaf: boolean
  key: string
  style?: string | Record<string, string>
  notSaved?: boolean
}

export function useDocs() {
  const { $api, $state } = useNuxtApp()
  const route = useRoute()

  const pages = useState<DocsPage[]>('docsPages', () => [])
  const openedTabs = useState<string[]>('openedDocsTabs', () => [])
  const openedPageSlug = computed(() => route.params.slugs[route.params.slugs.length - 1])
  const openedPage = computed(() => findPage(openedPageSlug.value))

  const openedNestedPages = computed(() => {
    const slugs = route.params.slugs
    const pages = slugs.map((slug) => findPage(slug)).filter((p) => p) as DocsPage[]
    return pages
  })

  // todo: Integrate useProject here
  const projectId = () => route.params.projectId as string

  const fetchPages = async ({ parentPageId, fetchChildren }: { parentPageId?: string; fetchChildren?: boolean } = {}) => {
    try {
      const docs = await $api.nocoDocs.listPages({
        projectId: projectId(),
        parent_page_id: parentPageId,
      })

      if (parentPageId) {
        const parentPage = findPage(parentPageId)
        if (!parentPage) return

        parentPage.children = docs.map((d) => ({ ...d, isLeaf: !d.is_parent, key: d.slug!, parentPageSlug: parentPage.slug }))
      } else {
        pages.value = docs.map((d, index) => ({
          ...d,
          isLeaf: !d.is_parent,
          key: d.slug!,
          style: {
            marginTop: index !== 0 ? '1.2rem' : '0.5rem',
          },
        }))
      }

      if (fetchChildren) {
        for (const doc of docs) {
          await fetchPages({ parentPageId: doc.id })
          if (!openedTabs.value.includes(doc.slug!)) {
            openedTabs.value.push(doc.slug!)
          }
        }
      }

      return docs
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  async function fetchNestedChildPagesFromRoute() {
    let parentPage: DocsPageType | undefined = pages.value.find((page) => page.slug === route.params.slugs[0])

    if (!route.params.slugs) return

    const slugs = (route.params.slugs as string[]).filter((_, index) => index !== 0)
    for (const slug of slugs) {
      const childDocs = await fetchPages({ parentPageId: parentPage?.id })

      if (!childDocs) throw new Error(`Nested Child Page not found:${parentPage?.id}`)
      parentPage = childDocs.find((page) => page.slug === slug)
    }

    for (const slug of route.params.slugs) {
      if (!openedTabs.value.includes(slug)) {
        openedTabs.value.push(slug)
      }
    }
  }

  const createPage = async (page: DocsPageType) => {
    try {
      const createdPageData = await $api.nocoDocs.createPage({ attributes: page, projectId: projectId() })

      if (page.parent_page_id) {
        const parentPage = findPage(page.parent_page_id)
        if (!parentPage) return

        if (!parentPage.children) parentPage.children = []
        parentPage.children?.push({
          ...createdPageData,
          isLeaf: !createdPageData.is_parent,
          key: createdPageData.slug!,
          parentPageSlug: parentPage.slug,
        })
        parentPage.isLeaf = false
      } else {
        pages.value.push({ ...createdPageData, isLeaf: !createdPageData.is_parent, key: createdPageData.slug! })
      }

      navigateTo(nestedUrl(createdPageData.slug!))

      if (!openedTabs.value.includes(createdPageData.slug!)) {
        openedTabs.value.push(createdPageData.slug!)
      }
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  // const addNewPage = async (parentPageId?: string) => {
  //   if (!parentPageId) {
  //     pages.value.push({ title: 'New Page', content: '', isLeaf: true, key: 'new-page', notSaved: true })
  //   } else {
  //     const parentPage = findPage(parentPageId)
  //     if (!parentPage) return

  //     if (!parentPage.children) parentPage.children = []
  //     parentPage.children.push({
  //       title: 'New Page',
  //       content: '',
  //       isLeaf: true,
  //       key: 'new-page',
  //       notSaved: true,
  //       parent_page_id: parentPageId,
  //       parentPageSlug: parentPage.slug,
  //     })
  //     parentPage.isLeaf = false
  //   }
  // }

  const deletePage = async (pageId: string) => {
    try {
      const page = findPage(pageId)
      await $api.nocoDocs.deletePage(pageId, { projectId: projectId() })

      if (page?.parent_page_id) {
        const parentPage = findPage(page.parent_page_id)
        if (!parentPage) return

        parentPage.children = parentPage.children?.filter((p) => p.id !== pageId)
        parentPage.isLeaf = parentPage.children?.length === 0
      } else {
        pages.value = pages.value.filter((p) => p.id !== pageId)
      }
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  function nestedUrl(slug: string) {
    const page = findPage(slug)!
    const slugs = [page.slug!]
    let parentPage = page
    while (parentPage.parentPageSlug) {
      slugs.unshift(parentPage.parentPageSlug)
      parentPage = findPage(parentPage.parentPageSlug)!
    }

    return `/nc/doc/${projectId()}/${slugs.join('/')}`
  }

  const createMagic = async (title: string) => {
    try {
      await $fetch(`http://localhost:8080/api/v1/docs/magic`, {
        method: 'POST',
        headers: { 'xc-auth': $state.token.value as string },
        body: {
          title,
          projectId: projectId(),
        },
      })
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const createImport = async (url: string, type: 'md' | 'nuxt' | 'docusaurus' = 'md', from: 'github' | 'file' = 'github') => {
    try {
      const rs = gh(url)
      await $fetch(`http://localhost:8080/api/v1/docs/import`, {
        method: 'POST',
        headers: { 'xc-auth': $state.token.value as string },
        body: {
          user: rs?.owner,
          repo: rs?.name,
          branch: rs?.branch,
          path: rs?.path?.replace(`${rs?.repo}/tree/${rs?.branch}/`, ''),
          projectId: projectId(),
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
    const findPageInTree = (_pages: DocsPage[], _pageIdOrSlug: string): DocsPage | undefined => {
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

  const updatePage = async (pageId: string, page: DocsPage) => {
    const updatedPage = await $api.nocoDocs.updatePage(pageId, { attributes: page, projectId: projectId() })
    if (page.title) {
      const foundPage = findPage(pageId)
      if (foundPage) {
        foundPage.slug = updatedPage.slug
      }
      await navigateTo(nestedUrl(updatedPage.slug!))
    }
  }

  const navigateToFirstPage = () => {
    if (pages.value.length) {
      navigateTo(nestedUrl(pages.value[0].slug!))
    }
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
      const sourceIndex = pages.value.findIndex((p) => p.id === sourceNode.id)
      // move the index to the correct position
      if (index > pages.value.length) {
        index = pages.value.length
      }
      pages.value.splice(index, 0, sourceNode)
      // remove the previous duplicate node by source index
      if (index > sourceIndex) {
        pages.value.splice(sourceIndex, 1)
      } else {
        pages.value.splice(sourceIndex + 1, 1)
      }

      sourceNode.parent_page_id = undefined
      sourceNode.parentPageSlug = undefined

      const node = findPage(sourceNodeId)!
      await $api.nocoDocs.updatePage(node.id!, {
        attributes: { order: index + 1 } as any,
        projectId: projectId(),
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
    sourceNode.parentPageSlug = targetParentNode.slug

    const node = findPage(sourceNodeId)!
    await $api.nocoDocs.updatePage(node.id!, {
      attributes: { order: index + 1, parent_page_id: targetParentNodeId } as any,
      projectId: projectId(),
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
    pages,
    createPage,
    createMagic,
    createImport,
    openedPageSlug,
    openedPage,
    updatePage,
    openedTabs,
    openedNestedPages,
    fetchNestedChildPagesFromRoute,
    nestedUrl,
    navigateToFirstPage,
    deletePage,
    reorderPages,
    // addNewPage,
  }
}
