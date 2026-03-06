import type { Editor } from '@tiptap/vue-3'
import { CellSelection } from '@tiptap/pm/tables'
import type { DocumentType } from 'nocodb-sdk'

/**
 * Encapsulates all link-related state and logic for the document editor:
 * - Paste-link embed menu (link vs embed choice)
 * - Link hover preview + edit popover (Notion-style, triggered on mouse hover)
 * - Page suggestion autocomplete in the link edit popover
 * - Rich text bubble menu visibility logic
 */
export function useDocEditorLinks({ editor, isEditable }: { editor: Ref<Editor | undefined>; isEditable: Ref<boolean> }) {
  // --- Paste link embed menu ---
  const pasteLinkMenu = ref<{
    visible: boolean
    url: string
    platform: string
    embedUrl: string
    from: number
    to: number
    top: number
    left: number
  }>({ visible: false, url: '', platform: '', embedUrl: '', from: 0, to: 0, top: 0, left: 0 })

  // Flag set synchronously before link insertion so the link hover preview
  // is suppressed even before the deferred pasteLinkMenu.visible = true
  const isPasteLinkPending = ref(false)

  const dismissPasteLinkMenu = () => {
    pasteLinkMenu.value.visible = false
    isPasteLinkPending.value = false
  }

  const keepAsLink = () => {
    dismissPasteLinkMenu()
  }

  const convertToEmbed = () => {
    const { from, to, embedUrl, url, platform } = pasteLinkMenu.value
    const ed = editor.value
    if (ed) {
      ed.chain().focus().setTextSelection({ from, to }).deleteSelection().insertEmbed({ src: embedUrl, url, platform }).run()
    }
    dismissPasteLinkMenu()
  }

  // --- Link input from bubble menu toolbar ---
  // Reuses the edit popover (linkEditUrl/linkEditTitle/linkEditRange/isLinkEditOpen).
  // A synthetic anchor element is used for positioning when opened from the toolbar
  // (since there's no real <a> element to anchor to).
  let syntheticAnchor: HTMLElement | null = null

  /** Opens the link edit popover from the bubble menu toolbar link button. */
  const openLinkInput = () => {
    const ed = editor.value
    if (!ed) return

    const { from, to } = ed.state.selection

    // Get existing link URL if the selection is already linked
    const linkMark = ed.state.doc
      .resolve(from)
      .marks()
      .find((m: any) => m.type.name === 'link')

    linkEditUrl.value = linkMark?.attrs?.href || ''
    linkEditTitle.value = ed.state.doc.textBetween(from, to, '') || ''
    linkEditRange.value = { from, to }

    // Create a synthetic anchor for positioning below the selection
    try {
      const coords = ed.view.coordsAtPos(from)
      const container = ed.view.dom.closest('.relative') as HTMLElement | null
      if (container) {
        const containerRect = container.getBoundingClientRect()
        syntheticAnchor = document.createElement('span')
        syntheticAnchor.style.cssText = `position:absolute;top:${coords.top - containerRect.top}px;left:${coords.left - containerRect.left}px;height:${coords.bottom - coords.top}px;width:0;pointer-events:none;`
        container.appendChild(syntheticAnchor)
        linkHoverEl.value = syntheticAnchor as any
      }
    } catch {
      // Fallback — popover may not position correctly
    }

    isLinkEditOpen.value = true
    isLinkHoverVisible.value = false
    nextTick(() => {
      linkEditInputRef.value?.focus()
      linkEditInputRef.value?.select()
    })
  }

  // --- Link hover preview + edit popover (Notion-style) ---
  const linkHoverUrl = ref('')
  const linkHoverTitle = ref('')
  const linkHoverEl = ref<HTMLAnchorElement | null>(null)
  const isLinkHoverVisible = ref(false)
  const isLinkEditOpen = ref(false)
  const linkEditUrl = ref('')
  const linkEditTitle = ref('')
  const linkEditInputRef = ref<HTMLInputElement>()
  // Store the link element's ProseMirror position range for applying edits
  const linkEditRange = ref<{ from: number; to: number } | null>(null)

  let hoverTimeout: ReturnType<typeof setTimeout> | undefined
  let leaveTimeout: ReturnType<typeof setTimeout> | undefined

  const showLinkHover = (el: HTMLAnchorElement) => {
    if (leaveTimeout) {
      clearTimeout(leaveTimeout)
      leaveTimeout = undefined
    }
    if (isLinkEditOpen.value) return
    if (pasteLinkMenu.value.visible || isPasteLinkPending.value) return

    linkHoverEl.value = el
    linkHoverUrl.value = el.getAttribute('href') || ''
    linkHoverTitle.value = el.textContent || ''
    isLinkHoverVisible.value = true
  }

  const hideLinkHover = () => {
    leaveTimeout = setTimeout(() => {
      if (!isLinkEditOpen.value) {
        isLinkHoverVisible.value = false
        linkHoverEl.value = null
      }
    }, 150)
  }

  const dismissLinkHover = () => {
    if (leaveTimeout) {
      clearTimeout(leaveTimeout)
      leaveTimeout = undefined
    }
    isLinkHoverVisible.value = false
    linkHoverEl.value = null
  }

  const keepLinkHoverAlive = () => {
    if (leaveTimeout) {
      clearTimeout(leaveTimeout)
      leaveTimeout = undefined
    }
  }

  const copyLinkUrl = async () => {
    if (!linkHoverUrl.value) return
    // Internal page links are stored as route paths — resolve to full URL for clipboard
    const url = extractDocIdFromUrl(linkHoverUrl.value)
      ? `${window.location.origin}#${linkHoverUrl.value}`
      : linkHoverUrl.value
    await navigator.clipboard.writeText(url)
  }

  /** Find the ProseMirror range of the link anchor element by DOM position */
  const findLinkRange = (el: HTMLAnchorElement): { from: number; to: number } | null => {
    const ed = editor.value
    if (!ed) return null
    const view = ed.view

    // Resolve the start and end DOM positions of the <a> element directly —
    // avoids matching the wrong node when adjacent links share the same URL
    const from = view.posAtDOM(el, 0)
    const to = view.posAtDOM(el, el.childNodes.length)
    if (from < 0 || to < 0 || from >= to) return null
    return { from, to }
  }

  const openLinkEdit = () => {
    if (!linkHoverEl.value) return
    linkEditUrl.value = linkHoverUrl.value
    linkEditTitle.value = linkHoverTitle.value
    linkEditRange.value = findLinkRange(linkHoverEl.value)
    isLinkEditOpen.value = true
    isLinkHoverVisible.value = false
    nextTick(() => {
      linkEditInputRef.value?.focus()
      linkEditInputRef.value?.select()
    })
  }

  /** Handle all keyboard events in the URL input — page suggestions + save/cancel */
  const onLinkEditUrlKeyDown = (e: KeyboardEvent) => {
    const suggestions = pageSuggestions.value

    if (e.key === 'Escape') {
      e.preventDefault()
      closeLinkEdit()
      return
    }

    if (suggestions.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        pageSuggestionIndex.value = (pageSuggestionIndex.value + 1) % suggestions.length
        scrollSuggestionIntoView()
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        pageSuggestionIndex.value = (pageSuggestionIndex.value + suggestions.length - 1) % suggestions.length
        scrollSuggestionIntoView()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        selectPageSuggestion(suggestions[pageSuggestionIndex.value])
        return
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      saveLinkEdit()
      return
    }
  }

  const saveLinkEdit = () => {
    const ed = editor.value
    if (!ed || !linkEditRange.value) return

    let href = linkEditUrl.value.trim()
    if (href && !/^[a-zA-Z]+:\/\//.test(href) && !href.startsWith('/')) {
      // If text matches a page title, link to that page instead of treating as URL
      const matchingPage = activeDocuments.value.find(
        (doc) => doc.id !== currentDocId.value && doc.title?.toLowerCase() === href.toLowerCase(),
      )
      if (matchingPage) {
        href = buildPageUrl(matchingPage)
      } else {
        href = `https://${href}`
      }
    }

    const { from, to } = linkEditRange.value
    const newTitle = linkEditTitle.value.trim()

    if (!href) {
      // URL cleared — remove the link mark entirely
      ed.chain().setTextSelection({ from, to }).extendMarkRange('link').unsetLink().run()
    } else if (newTitle) {
      // Replace both text and link mark
      ed.chain()
        .setTextSelection({ from, to })
        .insertContent({ type: 'text', text: newTitle, marks: [{ type: 'link', attrs: { href } }] })
        .run()
    } else {
      ed.chain().setTextSelection({ from, to }).extendMarkRange('link').setLink({ href }).run()
    }

    closeLinkEdit()
  }

  const deleteLinkEdit = () => {
    const ed = editor.value
    if (!ed || !linkEditRange.value) return
    const { from, to } = linkEditRange.value
    ed.chain().setTextSelection({ from, to }).extendMarkRange('link').unsetLink().run()
    closeLinkEdit()
  }

  const closeLinkEdit = () => {
    isLinkEditOpen.value = false
    isLinkHoverVisible.value = false
    linkHoverEl.value = null
    linkEditRange.value = null
    // Clean up synthetic anchor from toolbar-initiated edit
    if (syntheticAnchor) {
      syntheticAnchor.remove()
      syntheticAnchor = null
    }
    editor.value?.commands.focus()
  }

  /** Setup hover listeners on the editor container (event delegation).
   *  Returns a cleanup function that removes the listeners. */
  const setupLinkHover = (container: HTMLElement): (() => void) => {
    const onMouseOver = (e: MouseEvent) => {
      const linkEl = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null
      if (linkEl) {
        if (hoverTimeout) clearTimeout(hoverTimeout)
        hoverTimeout = setTimeout(() => showLinkHover(linkEl), 200)
      }
    }
    const onMouseOut = (e: MouseEvent) => {
      const linkEl = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null
      if (linkEl) {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout)
          hoverTimeout = undefined
        }
        hideLinkHover()
      }
    }
    container.addEventListener('mouseover', onMouseOver)
    container.addEventListener('mouseout', onMouseOut)
    return () => {
      container.removeEventListener('mouseover', onMouseOver)
      container.removeEventListener('mouseout', onMouseOut)
    }
  }

  // --- Page suggestion autocomplete ---
  const documentsStore = useDocumentsStore()
  const { activeDocuments, activeDocumentId: currentDocId } = storeToRefs(documentsStore)

  const basesStore = useBases()
  const { activeProjectId } = storeToRefs(basesStore)
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const pageSuggestionIndex = ref(0)

  /** Returns true if input looks like a URL rather than a page title search */
  const looksLikeUrl = (text: string): boolean => {
    return /^https?:\/\//.test(text) || /^www\./.test(text)
  }

  /** Filtered page suggestions based on linkEditUrl text.
   *  Only shows when text looks like a search (not a URL). */
  const pageSuggestions = computed<DocumentType[]>(() => {
    const query = linkEditUrl.value.trim().toLowerCase()
    if (!query || !isLinkEditOpen.value) return []
    if (looksLikeUrl(query)) return []

    return activeDocuments.value
      .filter((doc) => doc.id !== currentDocId.value && doc.title?.toLowerCase().includes(query))
      .slice(0, 6)
  })

  /** Returns true if query has no matches but doesn't look like a URL (for empty-state hint) */
  const hasNoPageSuggestions = computed(() => {
    const query = linkEditUrl.value.trim().toLowerCase()
    if (!query || !isLinkEditOpen.value) return false
    if (looksLikeUrl(query)) return false
    return pageSuggestions.value.length === 0
  })

  /** Extract doc ID from an internal page link URL.
   *  Matches routes like /{wsId}/{baseId}/docs/{docId} or /{wsId}/{baseId}/docs/{docId}/{slug} */
  const extractDocIdFromUrl = (url: string): string | null => {
    const match = url.match(/^\/[^/]+\/[^/]+\/docs\/([^/]+)/)
    return match ? match[1] : null
  }

  /** Build internal page URL for a document — mirrors ncNavigateTo route format */
  const buildPageUrl = (doc: DocumentType): string => {
    const slug = toReadableUrlSlug([doc.title])
    const docPath = `/docs/${doc.id}${slug ? `/${slug}` : ''}`
    const wsId = activeWorkspaceId.value || 'app'
    const baseId = activeProjectId.value || doc.base_id
    return `/${wsId}/${baseId}${docPath}`
  }

  /** Resolve a URL to its DocumentType if it's an internal page link */
  const resolvePageFromUrl = (url: string): DocumentType | null => {
    const docId = extractDocIdFromUrl(url)
    if (!docId) return null
    return activeDocuments.value.find((d) => d.id === docId) || null
  }

  /** Select a page from the suggestion list */
  const selectPageSuggestion = (doc: DocumentType) => {
    linkEditUrl.value = buildPageUrl(doc)
    linkEditTitle.value = doc.title || ''
    pageSuggestionIndex.value = 0
    // Save immediately after selecting a page
    saveLinkEdit()
  }

  watch(pageSuggestions, () => {
    pageSuggestionIndex.value = 0
  })

  /** Scroll the selected suggestion item into view */
  const scrollSuggestionIntoView = () => {
    nextTick(() => {
      const container = document.querySelector('.nc-link-page-suggestions')
      const selected = container?.querySelector('.is-selected') as HTMLElement | null
      selected?.scrollIntoView({ block: 'nearest' })
    })
  }

  /** Clear pending timeouts — call from onBeforeUnmount */
  const cleanupLinkHover = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      hoverTimeout = undefined
    }
    if (leaveTimeout) {
      clearTimeout(leaveTimeout)
      leaveTimeout = undefined
    }
  }

  /** Show rich text bubble menu on any non-empty text selection (including inside table cells),
   *  but NOT on multi-cell CellSelection or image NodeSelection (those have their own UI). */
  const showRichTextMenu = ({ editor: e }: { editor: any }) => {
    if (!isEditable.value) return false
    const { selection } = e.state
    if (selection instanceof CellSelection) return false
    // Hide for image / file attachment selections — they have their own UI
    if (
      selection.node?.type.name === 'image' ||
      selection.node?.type.name === 'fileAttachment' ||
      selection.node?.type.name === 'embed' ||
      selection.node?.type.name === 'horizontalRule'
    )
      return false
    // Hide inside code blocks — formatting doesn't apply to code
    if (selection.$from.parent.type.name === 'codeBlock') return false
    return !selection.empty
  }

  /** Handle onSelectionUpdate: close link edit when user changes selection */
  const onSelectionUpdate = () => {
    if (isLinkEditOpen.value) {
      closeLinkEdit()
    }
  }

  return {
    // Paste link embed
    pasteLinkMenu,
    isPasteLinkPending,
    dismissPasteLinkMenu,
    keepAsLink,
    convertToEmbed,

    // Link input (bubble menu toolbar)
    openLinkInput,

    // Page suggestion autocomplete
    pageSuggestions,
    pageSuggestionIndex,
    hasNoPageSuggestions,
    selectPageSuggestion,
    onLinkEditUrlKeyDown,
    resolvePageFromUrl,

    // Link hover preview + edit popover
    linkHoverUrl,
    linkHoverEl,
    isLinkHoverVisible,
    isLinkEditOpen,
    linkEditUrl,
    linkEditTitle,
    linkEditInputRef,
    hideLinkHover,
    dismissLinkHover,
    keepLinkHoverAlive,
    copyLinkUrl,
    openLinkEdit,
    saveLinkEdit,
    deleteLinkEdit,
    closeLinkEdit,
    setupLinkHover,
    cleanupLinkHover,

    // Bubble menu visibility
    showRichTextMenu,
    onSelectionUpdate,
  }
}
