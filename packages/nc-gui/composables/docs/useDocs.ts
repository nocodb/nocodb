import { message } from 'ant-design-vue'
import type { DocsPageType } from 'nocodb-sdk'
import gh from 'parse-github-url'
import { extractSdkResponseErrorMsg, useNuxtApp, useState } from '#imports'

export interface DocsPage extends DocsPageType {
  children?: DocsPage[]
  parentPageSlug?: string
  isLeaf: boolean
  key: string
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

  const fetchPages = async ({ parentPageId }: { parentPageId?: string; fetchNestedChildPagesFromRoute?: boolean } = {}) => {
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
        pages.value = docs.map((d) => ({ ...d, isLeaf: !d.is_parent, key: d.slug! }))
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
    await $api.nocoDocs.updatePage(pageId, { attributes: page, projectId: projectId() })
  }

  const navigateToFirstPage = () => {
    if (pages.value.length) {
      navigateTo(nestedUrl(pages.value[0].slug!))
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
  }
}
