import type { Editor } from '@tiptap/vue-3'
import { CellSelection } from '@tiptap/pm/tables'
import type { DocumentType } from 'nocodb-sdk'
import { slugifyHeading } from '../components/doc/DocHeadingAnchorExtension'

export interface HeadingSuggestion {
  level: number
  title: string
  slug: string
}

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

  // Declared early — used by closeLinkEdit, pageSuggestions watcher, and toggle logic below
  const expandedPageId = ref<string | null>(null)
  const expandedPageHeadings = ref<HeadingSuggestion[]>([])
  const isLoadingPageHeadings = ref(false)

  // --- Page suggestion autocomplete ---
  const { $api } = useNuxtApp()
  const documentsStore = useDocumentsStore()
  const { activeDocuments, activeDocumentId: currentDocId } = storeToRefs(documentsStore)

  const basesStore = useBases()
  const { activeProjectId } = storeToRefs(basesStore)
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const pageSuggestionIndex = ref(0)
  const headingSuggestionIndex = ref(0)

  // --- Link input from bubble menu toolbar ---
  // Reuses the edit popover (linkEditUrl/linkEditTitle/linkEditRange/isLinkEditOpen).
  // A synthetic anchor element is used for positioning when opened from the toolbar
  // (since there's no real <a> element to anchor to).
  let syntheticAnchor: HTMLElement | null = null

  let hoverTimeout: ReturnType<typeof setTimeout> | undefined
  let leaveTimeout: ReturnType<typeof setTimeout> | undefined

  // ── Helper functions (no forward references) ──

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

  /** Extract doc ID from an internal page link URL.
   *  Matches routes like /{wsId}/{baseId}/docs/{docId} or /{wsId}/{baseId}/docs/{docId}/{slug} */
  const extractDocIdFromUrl = (url: string): string | null => {
    const match = url.match(/^\/[^/]+\/[^/]+\/docs\/([^/]+)/)
    return match ? match[1] : null
  }

  const copyLinkUrl = async () => {
    if (!linkHoverUrl.value) return
    // Internal page links are stored as route paths — resolve to full URL for clipboard
    const url = extractDocIdFromUrl(linkHoverUrl.value) ? `${window.location.origin}#${linkHoverUrl.value}` : linkHoverUrl.value
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

  /** Returns true if input looks like a URL rather than a page title search */
  const looksLikeUrl = (text: string): boolean => {
    return /^https?:\/\//.test(text) || /^www\./.test(text)
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

  /** Scroll the selected suggestion item into view */
  const scrollSuggestionIntoView = () => {
    nextTick(() => {
      const container = document.querySelector('.nc-link-page-suggestions')
      const selected = container?.querySelector('.is-selected') as HTMLElement | null
      selected?.scrollIntoView({ block: 'nearest' })
    })
  }

  /** Extract headings from ProseMirror JSON content (no live editor needed) */
  function extractHeadingsFromJson(content: Record<string, any>): HeadingSuggestion[] {
    const headings: HeadingSuggestion[] = []
    const slugCounts = new Map<string, number>()

    function walk(node: any) {
      if (node.type === 'heading' && node.content) {
        const text = node.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text || '')
          .join('')
          .trim()
        if (text) {
          const baseSlug = slugifyHeading(text)
          const count = slugCounts.get(baseSlug) || 0
          slugCounts.set(baseSlug, count + 1)
          const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`
          headings.push({ level: node.attrs?.level || 1, title: text, slug })
        }
      }
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(walk)
      }
    }

    walk(content)
    return headings
  }

  // ── Computed ──

  /** Filtered page suggestions based on linkEditUrl text.
   *  Only shows when text looks like a search (not a URL). */
  const pageSuggestions = computed<DocumentType[]>(() => {
    const query = linkEditUrl.value.trim().toLowerCase()
    if (!query || !isLinkEditOpen.value) return []
    if (looksLikeUrl(query) || query.startsWith('#')) return []

    return activeDocuments.value
      .filter((doc) => doc.id !== currentDocId.value && doc.title?.toLowerCase().includes(query))
      .slice(0, 6)
  })

  /** Extract all headings from the current editor document */
  const headingSuggestions = computed<HeadingSuggestion[]>(() => {
    const query = linkEditUrl.value.trim().toLowerCase()
    if (!query.startsWith('#') || !isLinkEditOpen.value) return []

    const ed = editor.value
    if (!ed) return []

    const filter = query.slice(1) // strip leading '#'
    const headings: HeadingSuggestion[] = []
    const slugCounts = new Map<string, number>()

    ed.state.doc.descendants((node) => {
      if (node.type.name !== 'heading') return
      const text = node.textContent.trim()
      if (!text) return

      const baseSlug = slugifyHeading(text)
      const count = slugCounts.get(baseSlug) || 0
      slugCounts.set(baseSlug, count + 1)
      const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`

      headings.push({ level: node.attrs.level, title: text, slug })
    })

    if (!filter) return headings.slice(0, 8)

    return headings.filter((h) => h.title.toLowerCase().includes(filter) || h.slug.includes(filter)).slice(0, 8)
  })

  /** Returns true if user is actively searching (page or heading) but nothing matches */
  const hasNoSuggestions = computed(() => {
    const query = linkEditUrl.value.trim().toLowerCase()
    if (!query || !isLinkEditOpen.value) return false
    if (looksLikeUrl(query) || query.startsWith('/')) return false

    // Heading search: # followed by at least one filter character with no matches
    if (query.startsWith('#') && query.length > 1) {
      return headingSuggestions.value.length === 0
    }

    // Page search: non-URL text with no matches
    if (!query.startsWith('#')) {
      return pageSuggestions.value.length === 0
    }

    return false
  })

  // ── Functions that reference other functions (order matters) ──

  const closeLinkEdit = () => {
    isLinkEditOpen.value = false
    isLinkHoverVisible.value = false
    linkHoverEl.value = null
    linkEditRange.value = null
    expandedPageId.value = null
    expandedPageHeadings.value = []
    // Clean up synthetic anchor from toolbar-initiated edit
    if (syntheticAnchor) {
      syntheticAnchor.remove()
      syntheticAnchor = null
    }
    editor.value?.commands.focus()
  }

  const saveLinkEdit = () => {
    const ed = editor.value
    if (!ed || !linkEditRange.value) return

    let href = linkEditUrl.value.trim()
    if (href && !/^[a-zA-Z]+:\/\//.test(href) && !href.startsWith('/') && !href.startsWith('#')) {
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

  const selectPageSuggestion = (doc: DocumentType) => {
    linkEditUrl.value = buildPageUrl(doc)
    linkEditTitle.value = doc.title || ''
    pageSuggestionIndex.value = 0
    // Save immediately after selecting a page
    saveLinkEdit()
  }

  const selectHeadingSuggestion = (heading: HeadingSuggestion) => {
    linkEditUrl.value = `#${heading.slug}`
    headingSuggestionIndex.value = 0
    saveLinkEdit()
  }

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
        syntheticAnchor.style.cssText = `position:absolute;top:${coords.top - containerRect.top}px;left:${
          coords.left - containerRect.left
        }px;height:${coords.bottom - coords.top}px;width:0;pointer-events:none;`
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

  /** Handle all keyboard events in the URL input — page/heading suggestions + save/cancel */
  const onLinkEditUrlKeyDown = (e: KeyboardEvent) => {
    const pages = pageSuggestions.value
    const headings = headingSuggestions.value

    if (e.key === 'Escape') {
      e.preventDefault()
      closeLinkEdit()
      return
    }

    if (headings.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        headingSuggestionIndex.value = (headingSuggestionIndex.value + 1) % headings.length
        scrollSuggestionIntoView()
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        headingSuggestionIndex.value = (headingSuggestionIndex.value + headings.length - 1) % headings.length
        scrollSuggestionIntoView()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        selectHeadingSuggestion(headings[headingSuggestionIndex.value])
      }
    } else if (pages.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        pageSuggestionIndex.value = (pageSuggestionIndex.value + 1) % pages.length
        scrollSuggestionIntoView()
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        pageSuggestionIndex.value = (pageSuggestionIndex.value + pages.length - 1) % pages.length
        scrollSuggestionIntoView()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        selectPageSuggestion(pages[pageSuggestionIndex.value])
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      saveLinkEdit()
    }
  }

  /** Toggle section expansion for a page suggestion */
  const togglePageSections = async (doc: DocumentType) => {
    if (expandedPageId.value === doc.id) {
      expandedPageId.value = null
      expandedPageHeadings.value = []
      return
    }

    expandedPageId.value = doc.id!
    expandedPageHeadings.value = []
    isLoadingPageHeadings.value = true

    try {
      const fullDoc = (await $api.internal.getOperation(activeWorkspaceId.value!, activeProjectId.value!, {
        operation: 'documentGet',
        docId: doc.id!,
      })) as DocumentType

      if (fullDoc?.content) {
        expandedPageHeadings.value = extractHeadingsFromJson(fullDoc.content)
      }
    } catch {
      // silently fail — just show no sections
    } finally {
      isLoadingPageHeadings.value = false
    }
  }

  /** Select a heading from an expanded page's section list */
  const selectPageHeadingSuggestion = (doc: DocumentType, heading: HeadingSuggestion) => {
    const pageUrl = buildPageUrl(doc)
    linkEditUrl.value = `${pageUrl}#${heading.slug}`
    linkEditTitle.value = heading.title
    pageSuggestionIndex.value = 0
    expandedPageId.value = null
    expandedPageHeadings.value = []
    saveLinkEdit()
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
    // Show bubble menu for CellSelection — Editor.vue renders a cell color picker
    if (selection instanceof CellSelection) return true
    // Hide for image / file attachment / math selections — they have their own UI
    if (
      selection.node?.type.name === 'image' ||
      selection.node?.type.name === 'fileAttachment' ||
      selection.node?.type.name === 'embed' ||
      selection.node?.type.name === 'horizontalRule' ||
      selection.node?.type.name === 'inlineMath' ||
      selection.node?.type.name === 'docTabs'
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

  // ── Watchers ──

  watch(pageSuggestions, () => {
    pageSuggestionIndex.value = 0
    // Collapse expanded page sections when suggestions change
    expandedPageId.value = null
    expandedPageHeadings.value = []
  })

  watch(headingSuggestions, () => {
    headingSuggestionIndex.value = 0
  })

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
    hasNoSuggestions,
    selectPageSuggestion,
    onLinkEditUrlKeyDown,
    resolvePageFromUrl,

    // Heading (section) suggestion autocomplete
    headingSuggestions,
    headingSuggestionIndex,
    selectHeadingSuggestion,

    // Page section expansion
    expandedPageId,
    expandedPageHeadings,
    isLoadingPageHeadings,
    togglePageSections,
    selectPageHeadingSuggestion,

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
