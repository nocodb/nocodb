import { message } from 'ant-design-vue'
import type { DocsPageType } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useNuxtApp, useProject, useState } from '#imports'

export interface DocsPage extends DocsPageType {
  children?: DocsPage[]
  isLeaf: boolean
  key: string
}

export function useDocs() {
  const { $api } = useNuxtApp()
  const route = useRoute()

  const pages = useState<DocsPage[]>('docsPages', () => [])
  const openedPageId = useState<string>('openedPageId', () => '')
  const openedPage = computed(() => findPage(openedPageId.value))

  // todo: Integrate useProject here
  const projectId = () => route.params.projectId as string

  const fetchPages = async (parentPageId?: string | undefined) => {
    try {
      const docs = await $api.nocoDocs.listPages({
        projectId: projectId(),
        parentPageId,
      })

      if (parentPageId) {
        const parentPage = findPage(parentPageId)
        if (!parentPage) return

        parentPage.children = docs.map((d) => ({ ...d, isLeaf: !d.is_parent, key: d.id! }))
      } else {
        pages.value = docs.map((d) => ({ ...d, isLeaf: !d.is_parent, key: d.id! }))
      }

      if (docs.length > 0) openedPageId.value = docs[0].id!
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const createPage = async (page: DocsPage) => {
    try {
      const createdPageData = await $api.nocoDocs.createPage({ ...page, projectId: projectId() })

      if (page.parentPageId) {
        const parentPage = findPage(page.parentPageId)
        if (!parentPage) return

        if (!parentPage.children) parentPage.children = []
        parentPage.children?.push({
          ...createdPageData,
          isLeaf: !createdPageData.is_parent,
          key: createdPageData.id!,
        })
        parentPage.isLeaf = false
      } else {
        pages.value.push({ ...createdPageData, isLeaf: !createdPageData.is_parent, key: createdPageData.id! })
      }

      openedPageId.value = createdPageData.id!
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  function findPage(pageId: string) {
    // traverse the tree and find the parent page
    const findPageInTree = (_pages: DocsPage[], pageId: string): DocsPage | undefined => {
      for (const page of _pages) {
        if (page.id === pageId) return page

        if (page.children) {
          const foundPage = findPageInTree(page.children, pageId)
          if (foundPage) return foundPage
        }
      }
    }

    return findPageInTree(pages.value, pageId)
  }

  const updatePage = async (pageId: string, page: DocsPage) => {
    await $api.nocoDocs.updatePage(pageId, page)
  }

  return { fetchPages, pages, createPage, openedPageId, openedPage, updatePage }
}
