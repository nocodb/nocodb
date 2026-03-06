import type { Editor } from '@tiptap/vue-3'
import { CellSelection } from '@tiptap/pm/tables'

/**
 * Encapsulates all link-related state and logic for the document editor:
 * - Paste-link embed menu (link vs embed choice)
 * - Inline link input in the bubble menu (create/edit links)
 * - Link hover preview + edit popover (Notion-style, triggered on mouse hover)
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

  // --- Link input inside bubble menu ---
  const isLinkInputMode = ref(false)
  const linkInputUrl = ref('')
  const linkInputRef = ref<HTMLInputElement>()
  // Snapshot the selection range so we can re-apply after the input steals focus
  const linkSelectionRange = ref<{ from: number; to: number } | null>(null)
  // Suppress onSelectionUpdate reset while our code is manipulating the selection
  const isLinkInputSuppressSelectionReset = ref(false)

  const openLinkInput = () => {
    const ed = editor.value
    if (!ed) return

    // If selected text is already a link, prefill the URL
    const { from, to } = ed.state.selection
    linkSelectionRange.value = { from, to }

    const linkMark = ed.state.doc
      .resolve(from)
      .marks()
      .find((m: any) => m.type.name === 'link')
    linkInputUrl.value = linkMark?.attrs?.href || ''

    isLinkInputSuppressSelectionReset.value = true
    isLinkInputMode.value = true
    nextTick(() => {
      linkInputRef.value?.focus()
      linkInputRef.value?.select()
      // Re-enable selection reset after the focus change settles
      nextTick(() => {
        isLinkInputSuppressSelectionReset.value = false
      })
    })
  }

  const applyLink = () => {
    const ed = editor.value
    if (!ed || !linkSelectionRange.value) return

    isLinkInputSuppressSelectionReset.value = true

    const { from, to } = linkSelectionRange.value
    let href = linkInputUrl.value.trim()

    if (href) {
      // Auto-prepend https:// if no protocol
      if (!/^[a-zA-Z]+:\/\//.test(href) && !href.startsWith('/')) {
        href = `https://${href}`
      }
      ed.chain().focus().setTextSelection({ from, to }).setLink({ href }).run()
    } else {
      ed.chain().focus().setTextSelection({ from, to }).unsetLink().run()
    }

    isLinkInputMode.value = false
    linkInputUrl.value = ''
    linkSelectionRange.value = null
    nextTick(() => {
      isLinkInputSuppressSelectionReset.value = false
    })
  }

  const cancelLinkInput = () => {
    isLinkInputSuppressSelectionReset.value = true
    isLinkInputMode.value = false
    linkInputUrl.value = ''
    if (linkSelectionRange.value) {
      editor.value?.chain().focus().setTextSelection(linkSelectionRange.value).run()
    }
    linkSelectionRange.value = null
    nextTick(() => {
      isLinkInputSuppressSelectionReset.value = false
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
    if (linkHoverUrl.value) {
      await navigator.clipboard.writeText(linkHoverUrl.value)
    }
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

  const saveLinkEdit = () => {
    const ed = editor.value
    if (!ed || !linkEditRange.value) return

    let href = linkEditUrl.value.trim()
    if (href && !/^[a-zA-Z]+:\/\//.test(href) && !href.startsWith('/')) {
      href = `https://${href}`
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
    // Keep bubble menu visible while link input is open
    if (isLinkInputMode.value) return true
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

  /** Handle onSelectionUpdate: dismiss link input when user changes selection */
  const onSelectionUpdate = () => {
    if (isLinkInputMode.value && !isLinkInputSuppressSelectionReset.value) {
      isLinkInputMode.value = false
      linkInputUrl.value = ''
      linkSelectionRange.value = null
    }
  }

  return {
    // Paste link embed
    pasteLinkMenu,
    isPasteLinkPending,
    dismissPasteLinkMenu,
    keepAsLink,
    convertToEmbed,

    // Link input (bubble menu)
    isLinkInputMode,
    linkInputUrl,
    linkInputRef,
    openLinkInput,
    applyLink,
    cancelLinkInput,

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
