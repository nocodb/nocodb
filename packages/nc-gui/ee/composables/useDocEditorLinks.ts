import type { Editor } from '@tiptap/vue-3'
import { CellSelection } from '@tiptap/pm/tables'

/**
 * Encapsulates all link-related state and logic for the document editor:
 * - Paste-link embed menu (link vs embed choice)
 * - Inline link input in the bubble menu (create/edit links)
 * - Link edit bubble menu (for clicking on existing links)
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

  const dismissPasteLinkMenu = () => {
    pasteLinkMenu.value.visible = false
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

  // --- Link options bubble menu (for clicking on existing links) ---
  const linkEditUrl = ref('')
  const linkEditMark = ref<any>(null)
  const isLinkEditVisible = ref(false)
  const linkEditInputRef = ref<HTMLInputElement>()

  const checkLinkMark = ({ editor: e }: { editor: any }) => {
    if (!e.view.editable) return false

    const { selection } = e.state
    const isTextSelected = selection.from !== selection.to
    if (isTextSelected) return false

    const activeNode = selection.$from?.nodeBefore || selection.$from?.nodeAfter
    const linkMark = activeNode?.marks?.find((m: any) => m.type.name === 'link')
    if (!linkMark) {
      isLinkEditVisible.value = false
      return false
    }

    linkEditMark.value = linkMark
    linkEditUrl.value = linkMark.attrs?.href || ''
    isLinkEditVisible.value = true
    return true
  }

  const onLinkEditChange = () => {
    const ed = editor.value
    if (!ed) return

    let href = linkEditUrl.value.trim()
    if (href && !/^[a-zA-Z]+:\/\//.test(href) && !href.startsWith('/')) {
      href = `https://${href}`
    }

    if (href) {
      // Find the range of the link mark around the cursor
      const { $from } = ed.state.selection
      const range = $from.nodeBefore
        ? { from: $from.pos - $from.nodeBefore.nodeSize, to: $from.pos }
        : { from: $from.pos, to: $from.pos + ($from.nodeAfter?.nodeSize || 0) }

      ed.chain().setTextSelection(range).extendMarkRange('link').setLink({ href }).setTextSelection($from.pos).run()
    }
  }

  const deleteLinkEdit = () => {
    const ed = editor.value
    if (!ed) return
    ed.chain().focus().extendMarkRange('link').unsetLink().run()
    isLinkEditVisible.value = false
  }

  const openLinkExternal = () => {
    if (linkEditUrl.value) {
      window.open(linkEditUrl.value, '_blank', 'noopener,noreferrer')
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
      selection.node?.type.name === 'embed'
    )
      return false
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

    // Link edit (existing links)
    linkEditUrl,
    linkEditMark,
    isLinkEditVisible,
    linkEditInputRef,
    checkLinkMark,
    onLinkEditChange,
    deleteLinkEdit,
    openLinkExternal,

    // Bubble menu visibility
    showRichTextMenu,
    onSelectionUpdate,
  }
}
