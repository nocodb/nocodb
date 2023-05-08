import { defineStore } from 'pinia'
import type { DocsPageType } from 'nocodb-sdk'
import { generateHTML } from '@tiptap/html'
import diff from '~~/utils/htmlDiff'
import tiptapExtensions from '~~/utils/tiptapExtensions'
import { removeUploadingPlaceHolderAndEmptyLinkNode } from '~~/utils/tiptapExtensions/helper'

export const useDocHistoryStore = defineStore('docHistoryStore', () => {
  const history = ref<DocsPageType[]>([])
  const currentHistory = ref<DocsPageType | null>()

  const { openedPage } = storeToRefs(useDocStore())

  watch(
    () => openedPage.value?.content,
    (newPageContent, oldPageContent) => {
      if (!newPageContent) return
      if (newPageContent === oldPageContent) return

      const newContent = removeUploadingPlaceHolderAndEmptyLinkNode(JSON.parse(newPageContent))
      const oldContent = oldPageContent ? removeUploadingPlaceHolderAndEmptyLinkNode(JSON.parse(oldPageContent)) : newContent

      const newContentString = JSON.stringify(newContent)
      const oldContentString = JSON.stringify(oldContent)

      if (newContentString === oldContentString) return

      // TODO: Hacky way of forcing html diff to detect empty paragraph
      const newContentHtml = generateHTML(newContent, tiptapExtensions(false)).replace(/<p><\/p>/g, '<p #custom>Empty</p>')
      const oldContentHtml = generateHTML(oldContent, tiptapExtensions(false)).replace(/<p><\/p>/g, '<p #custom>Empty</p>')

      const _diff = diff(oldContentHtml, newContentHtml)
        .replaceAll('>Empty</ins>', ' class="empty">__nc_empty__</ins>')
        .replaceAll('>Empty</del>', ' class="empty">__nc_empty__</del>')
        .replaceAll('<p #custom>Empty</p>', '<p></p>')

      history.value.push({
        ...openedPage.value!,
        content: _diff,
      })
    },
    {
      deep: true,
    },
  )

  const setCurrentHistory = (page: DocsPageType | null) => {
    currentHistory.value = page
  }

  return {
    history,
    currentHistory,
    setCurrentHistory,
  }
})
