<script setup lang="ts">
import { PermissionEntity, PermissionKey, PlanFeatureTypes } from 'nocodb-sdk'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu, EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TableRow from '@tiptap/extension-table-row'
import { Selection, TextSelection } from '@tiptap/pm/state'
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import { DocHighlightExtension } from './DocHighlightExtension'
import { DocTextColorExtension } from './DocTextColorExtension'
import { DocCommentMarkExtension } from './DocCommentMarkExtension'
import { DocImageExtension } from './DocImageExtension'
import { DocFileAttachmentExtension } from './DocFileAttachmentExtension'
import { DocEmbedExtension } from './DocEmbedExtension'
import { DocCodeBlockExtension } from './DocCodeBlockExtension'
import { DocTable, DocTableCell, DocTableHeader } from './DocTableExtensions'
import { SlashCommandExtension, embedPlatformIcons } from './SlashCommand'
import { CalloutExtension } from './CalloutExtension'
import { DocColumnExtension, DocColumnsExtension } from './DocColumnsExtension'
import { DocTabExtension, DocTabsExtension } from './DocTabsExtension'
import { DocColumnsToolbarExtension } from './DocColumnsToolbarPlugin'
import { DocMathExtension } from './DocMathExtension'
import { DocActiveBlockExtension } from './DocActiveBlockPlugin'
import { DocHeadingCollapseExtension } from './DocHeadingCollapseExtension'
import { DocHeadingAnchorExtension } from './DocHeadingAnchorExtension'
import { DocDragHandleExtension } from './DocDragHandlePlugin'
import { DocSearchExtension } from './DocSearchExtension'
import { getEmbedURL } from '~/extensions/url-preview-ee/utils'
import { TaskItem } from '~/helpers/tiptap-markdown/extensions/nodes/task-item'
import { UserMention, UserMentionList } from '~/helpers/tiptap-markdown/extensions/nodes/mention'
import { suggestion } from '~/helpers/tiptap'

const props = defineProps<{
  docId: string
}>()

const docId = toRef(props, 'docId')

provide(DocIdInj, docId)

const basesStore = useBases()
const { activeProjectId, basesUser } = storeToRefs(basesStore)

const documentsStore = useDocumentsStore()
const { createDocument, deleteDocument, loadDocument, updateDocument } = documentsStore

const { $e } = useNuxtApp()
const { user, appInfo, isMobileMode, isLeftSidebarOpen } = useGlobal()
const { t } = useI18n()
const { isUIAllowed } = useRoles()
const { isAllowed: isPermissionAllowed } = usePermissions()
const { openFilePicker, uploadAndInsert } = useDocumentImageUpload()
const { batchUploadFiles } = useAttachment()
const { openFilePicker: openFileAttachmentPicker, uploadAndInsert: uploadAndInsertFile } = useDocumentFileUpload()

const { activeDocuments } = storeToRefs(documentsStore)

const base = inject(ProjectInj, ref())

const isCreatorOrAbove = computed(() => isUIAllowed('documentCreate'))

/**
 * Check document-level DOCUMENT_EDIT permission by walking up the parent chain.
 * Uses useDocPermissionResolver to find the nearest ancestor with explicit permission,
 * then delegates to isPermissionAllowed for user-level evaluation.
 */
const basePermissions = computed(() => base.value?.permissions)

const { findDocWithExplicitPermission } = useDocPermissionResolver(basePermissions, activeDocuments)

const isDocEditAllowed = computed(() => {
  if (!basePermissions.value) return true

  const effectiveDocId = findDocWithExplicitPermission(docId.value, PermissionKey.DOCUMENT_EDIT)
  if (!effectiveDocId) return true // No doc-level edit restriction → default allows editors+

  return isPermissionAllowed(PermissionEntity.DOCUMENT, effectiveDocId, PermissionKey.DOCUMENT_EDIT)
})

/** Whether the current user can edit document content (base role + doc-level permission). */
const isEditable = computed(() => isUIAllowed('documentUpdate') && isDocEditAllowed.value)

// Resolve created_by user ID to display name
const idUserMap = computed<Record<string, any>>(() => {
  if (!base.value?.id) return {}
  return (basesUser.value.get(base.value.id) || []).reduce((acc: Record<string, any>, u: any) => {
    acc[u.id] = u
    acc[u.email] = u
    return acc
  }, {})
})

const mentionUsers = computed(() => {
  if (!base.value?.id) return []
  return (basesUser.value.get(base.value.id) || []).filter((u: any) => u.deleted !== true)
})

const resolveUserLabel = (userId?: string) => {
  if (!userId) return ''
  const u = idUserMap.value[userId]
  if (!u) return ''
  if (u.id === user.value?.id) return 'you'
  return u.display_name || u.email || ''
}

const titleInput = useTemplateRef('titleInput')
const scrollContainerRef = ref<HTMLElement | null>(null)

const isTitleVisible = ref(true)

// --- Composables (declared before useEditor so callbacks can reference them) ---

const editor = shallowRef<Editor | undefined>()

const {
  doc,
  title,
  lastSavedTitle,
  isSaving,
  isLoaded,
  isStale,
  staleUpdatedBy,
  debouncedSave,
  loadAndSetDoc,
  reloadDocument,
  flushOnUnmount,
  activeDocument,
} = useDocumentAutoSave({ editor, activeProjectId, isEditable })

const docMeta = computed(() => parseProp(doc.value?.meta))

const {
  pasteLinkMenu,
  isPasteLinkPending,
  dismissPasteLinkMenu,
  keepAsLink,
  convertToEmbed,
  openLinkInput,
  pageSuggestions,
  pageSuggestionIndex,
  hasNoSuggestions,
  selectPageSuggestion,
  onLinkEditUrlKeyDown,
  resolvePageFromUrl,
  headingSuggestions,
  headingSuggestionIndex,
  selectHeadingSuggestion,
  expandedPageId,
  expandedPageHeadings,
  isLoadingPageHeadings,
  togglePageSections,
  selectPageHeadingSuggestion,
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
  showRichTextMenu,
  onSelectionUpdate,
} = useDocEditorLinks({ editor, isEditable })

const { downloadMarkdown, downloadHTML, downloadPDF } = useDocumentExport({ editor, title })

const { scrollToHeading } = useDocHeadingAnchors(editor, scrollContainerRef, isLoaded)

const { copy } = useCopy()

const { isCopied: isLinkCopied, performCopy: performCopyLink } = useIsCopied(2000)

// --- Search & Replace bar state (Cmd/Ctrl+F) ---
// The bar is rendered inside the editor's relative wrapper and uses
// DocSearchExtension (ProseMirror plugin) for match finding + decorations.
const isSearchOpen = ref(false)
const searchBarRef = ref<{ focusSearch: () => void } | null>(null)

// --- Comments sidebar state ---
const isCommentsPanelOpen = ref(false)
const pendingInlineCommentSelection = ref<{ from: number; to: number } | null>(null)

const toggleCommentsPanel = () => {
  isCommentsPanelOpen.value = !isCommentsPanelOpen.value
}

const { showUpgradeToUseDocsInlineComments, showUpgradeToUseDocsExportPdf } = useEeConfig()

const onAddInlineComment = () => {
  if (showUpgradeToUseDocsInlineComments()) {
    // Collapse selection to dismiss the BubbleMenu behind the upgrade modal
    if (editor.value) {
      const { to } = editor.value.state.selection
      editor.value.commands.setTextSelection(to)
    }
    return
  }

  if (!editor.value) return
  const { from, to } = editor.value.state.selection
  if (from === to) return // no selection
  pendingInlineCommentSelection.value = { from, to }
  isCommentsPanelOpen.value = true
  // Collapse selection to dismiss the BubbleMenu
  editor.value.commands.setTextSelection(to)
}

// Click on inline comment mark → open sidebar and scroll to that comment
const pendingAnchorId = ref<string | null>(null)

const onEditorClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  // Click on a link — navigate internally for page links, open in new tab for external
  const linkEl = target.closest('a[href]') as HTMLAnchorElement | null
  if (linkEl?.href) {
    e.preventDefault()
    const href = linkEl.getAttribute('href') || ''
    // Hash-only link — scroll to heading within the same document
    if (href.startsWith('#') && href.length > 1) {
      scrollToHeading(href.slice(1))
    } else if (resolvePageFromUrl(href)) {
      // Internal page link — resolves to a known document
      navigateTo(href)
    } else {
      window.open(linkEl.href, '_blank', 'noopener,noreferrer')
    }
    return
  }

  const commentEl = target.closest('[data-comment-id]') as HTMLElement | null
  if (!commentEl) return

  const anchorId = commentEl.getAttribute('data-comment-id')
  if (!anchorId) return

  const { comments, scrollToComment } = useDocumentComments()
  const matchingComment = comments.value.find((c) => c.anchor_id === anchorId)

  if (matchingComment?.id) {
    // Comments already loaded — scroll directly
    isCommentsPanelOpen.value = true
    nextTick(() => scrollToComment(matchingComment.id!))
  } else {
    // Sidebar not open yet / comments not loaded — store anchor and open
    pendingAnchorId.value = anchorId
    isCommentsPanelOpen.value = true
  }
}

// Resolve pending anchor once comments are loaded
const {
  comments: docComments,
  activeDocId: commentsDocId,
  scrollToComment: scrollToDocComment,
  isCommentsLoading: isDocCommentsLoading,
} = useDocumentComments()

// Comment count: prefer live list length once comments have been loaded (panel opened),
// but only when the comments belong to the current doc. The comments composable is a
// singleton — after navigating away with the panel closed, it still holds the old doc's
// comments, which would show a stale count.
const commentCount = computed(() => {
  if (commentsDocId.value === docId.value && docComments.value.length) return docComments.value.length
  return doc.value?.comment_count ?? 0
})

watch(isDocCommentsLoading, (loading, wasLoading) => {
  if (wasLoading && !loading && pendingAnchorId.value) {
    const match = docComments.value.find((c) => c.anchor_id === pendingAnchorId.value)
    if (match?.id) {
      nextTick(() => scrollToDocComment(match.id!))
    }
    pendingAnchorId.value = null
  }
})

// Deep link — open comments sidebar if ?commentId= is present in URL
const route = useRoute()
const router = useRouter()

onMounted(() => {
  const commentId = route.query.commentId as string | undefined
  if (commentId) {
    isCommentsPanelOpen.value = true
    // Remove commentId from query after opening
    const { commentId: _, ...query } = route.query
    router.replace({ query })
  }
})

// Keyboard navigation active index for paste-link menu (declared before editor so handleKeyDown can access it)
const pasteLinkActiveIndex = ref(0)

/**
 * Detect whether plain text looks like markdown by checking for common patterns.
 * We only trigger markdown parsing when there's strong evidence — at least one
 * structural markdown element (heading, list, code fence, blockquote, hr, link, image).
 */
const looksLikeMarkdown = (text: string): boolean => {
  const patterns = [
    /^#{1,6}\s/m, // headings
    /^[-*+]\s/m, // unordered list
    /^\d+\.\s/m, // ordered list
    /^```/m, // fenced code block
    /^>\s/m, // blockquote
    /^---+$/m, // horizontal rule
    /\[.+?\]\(.+?\)/, // links / images
    /\*\*.+?\*\*/, // bold
    /~~.+?~~/, // strikethrough
    /^\|.+\|$/m, // table row (pipes)
    /^\|[\s-:|]+\|$/m, // table separator row
  ]
  // Require at least 2 matches to avoid false positives on simple text
  let hits = 0
  for (const p of patterns) {
    if (p.test(text)) hits++
    if (hits >= 2) return true
  }
  return false
}

const _tiptapEditor = useEditor({
  editable: isEditable.value,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false, // replaced by DocCodeBlockExtension (lowlight + language selector)
    }),
    DocCodeBlockExtension,
    Underline,
    DocHighlightExtension,
    DocTextColorExtension,
    DocCommentMarkExtension,
    Link.configure({ openOnClick: false }),
    Placeholder.configure({
      placeholder: ({ editor, node, hasAnchor }) => {
        if (!hasAnchor) return ''
        if (editor.isEmpty) return t('placeholder.docEditor')
        // Non-empty doc: show a subtle hint on the focused empty paragraph
        if (node.type.name === 'paragraph') return t('placeholder.docEditorLine')
        return ''
      },
      showOnlyCurrent: true,
    }),
    DocImageExtension,
    TaskList,
    TaskItem.configure({ nested: true }),
    // resizable: false — disables columnResizing plugin (its TableView causes crashes).
    // DocTable also strips <colgroup> from renderHTML (see DocTableExtensions.ts).
    DocTable.configure({ resizable: false }),
    TableRow,
    DocTableCell,
    DocTableHeader,
    SlashCommandExtension,
    UserMention.configure({
      suggestion: {
        ...suggestion(UserMentionList),
        items: ({ query }: { query: string }) =>
          mentionUsers.value
            .map((u: any) => ({ id: u.id, name: u.display_name, email: u.email, meta: u.meta }))
            .filter((u) => searchCompare([u.name, u.email], query)),
      },
      users: unref(mentionUsers.value),
      currentUser: unref(user.value),
    }),
    CalloutExtension,
    DocColumnsExtension,
    DocColumnExtension,
    DocTabsExtension,
    DocTabExtension,
    DocColumnsToolbarExtension,
    DocMathExtension,
    DocFileAttachmentExtension,
    DocEmbedExtension,
    DocActiveBlockExtension,
    DocHeadingCollapseExtension,
    DocHeadingAnchorExtension,
    DocDragHandleExtension,
    DocSearchExtension,
  ],
  editorProps: {
    attributes: {
      class: 'nc-doc-editor-content focus:outline-none min-h-[200px]',
    },
    handleKeyDown(view, event) {
      // Note: Cmd/Ctrl+F is handled by a document-level keydown listener
      // (onDocKeydown) so it works even when the editor isn't focused.

      // Paste-link menu keyboard navigation — must be handled here
      // (before ProseMirror) so Enter/arrows aren't consumed by the editor
      if (pasteLinkMenu.value.visible) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          pasteLinkActiveIndex.value = Math.min(pasteLinkActiveIndex.value + 1, 1)
          return true
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          pasteLinkActiveIndex.value = Math.max(pasteLinkActiveIndex.value - 1, 0)
          return true
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          ;[keepAsLink, convertToEmbed][pasteLinkActiveIndex.value]()
          return true
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          dismissPasteLinkMenu()
          return true
        }
      }

      const { state } = view
      const { selection } = state
      const { $from, empty } = selection

      // Escape inside a table: move cursor to first paragraph after the table.
      // If no paragraph exists after the table, insert one.
      if (event.key === 'Escape') {
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d)
          if (node.type.name === 'table') {
            const tableEndPos = $from.after(d)
            const $afterTable = state.doc.resolve(tableEndPos)

            // Check if a block exists right after the table
            if ($afterTable.nodeAfter) {
              // Move cursor to start of the next block
              view.dispatch(state.tr.setSelection(state.selection.constructor.near(state.doc.resolve(tableEndPos + 1))))
            } else {
              // No block after table — insert an empty paragraph and focus it
              const paragraph = state.schema.nodes.paragraph.create()
              const tr = state.tr.insert(tableEndPos, paragraph)
              tr.setSelection(state.selection.constructor.near(tr.doc.resolve(tableEndPos + 1)))
              view.dispatch(tr)
            }
            return true
          }
        }
        return false
      }

      // Tab inside a code block: insert 2 spaces for indentation
      if (event.key === 'Tab' && $from.parent.type.name === 'codeBlock') {
        event.preventDefault()
        view.dispatch(state.tr.insertText('  ', $from.pos, selection.to))
        return true
      }

      // Progressive select-all (Notion-like):
      // 1st Cmd+A → select all text in the current block
      // 2nd Cmd+A → select entire document (default ProseMirror behavior)
      if (event.key === 'a' && (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey) {
        // Find the innermost text block (paragraph, heading, codeBlock, etc.)
        const blockStart = $from.start($from.depth)
        const blockEnd = $from.end($from.depth)

        // Check if the entire block text is already selected
        const blockFullySelected = selection.from === blockStart && selection.to === blockEnd

        if (!blockFullySelected) {
          // First Cmd+A: select all text in the current block
          event.preventDefault()
          view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, blockStart, blockEnd)))
          return true
        }

        // Block already fully selected — fall through to ProseMirror's default selectAll (entire doc)
        return false
      }

      if (event.key !== 'Backspace') return false

      // Only handle when cursor is collapsed (no selection range)
      if (!empty) return false

      // Skip when inside a table cell — let the table plugin handle it
      for (let d = $from.depth; d > 0; d--) {
        const ancestor = $from.node(d).type.name
        if (ancestor === 'tableCell' || ancestor === 'tableHeader') return false
      }

      // Check if cursor is at the very start of the current block node
      if ($from.parentOffset !== 0) return false

      const nodeType = $from.parent.type.name

      // For headings / code blocks: convert to paragraph (strip formatting)
      if (nodeType === 'heading' || nodeType === 'codeBlock') {
        view.dispatch(state.tr.setBlockType($from.before(), $from.after(), state.schema.nodes.paragraph))
        return true
      }

      // Paragraph at the very start of a callout / blockquote:
      // unwrap the wrapper, keeping all its children as siblings.
      // ProseMirror's default joinBackward can't lift when the wrapper
      // would be left empty (content: 'block+'), so we handle it here.
      if (nodeType === 'paragraph') {
        for (let d = $from.depth - 1; d >= 1; d--) {
          const ancestor = $from.node(d)
          if (ancestor.type.name === 'callout' || ancestor.type.name === 'blockquote') {
            if (d === $from.depth - 1 && $from.index(d) === 0) {
              const pos = $from.before(d)
              view.dispatch(state.tr.replaceWith(pos, pos + ancestor.nodeSize, ancestor.content))
              return true
            }
            break
          }
        }

        // First empty block in document: delete it when there are siblings below.
        // ProseMirror's default joinBackward can't remove the very first block.
        if ($from.index(0) === 0 && $from.parent.content.size === 0 && state.doc.childCount > 1) {
          const topPos = $from.before(1)
          const topNode = state.doc.child(0)
          const tr = state.tr.delete(topPos, topPos + topNode.nodeSize)
          tr.setSelection(Selection.near(tr.doc.resolve(0), 1))
          view.dispatch(tr)
          return true
        }
      }

      return false
    },
    handleDrop(view, event, _slice, moved) {
      // Internal drag (reorder) — let ProseMirror handle it
      if (moved) return false

      const files = Array.from(event.dataTransfer?.files || [])
      if (!files.length) return false

      const images = files.filter((f) => f.type.startsWith('image/'))
      const nonImages = files.filter((f) => !f.type.startsWith('image/'))

      const ed = editor.value
      if (!ed) return false

      event.preventDefault()

      // Position cursor at drop point
      const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
      if (pos) ed.commands.setTextSelection(pos.pos)

      // Batch-insert image placeholder nodes in a single transaction
      if (images.length) {
        const imgEntries = images.map((img) => ({
          file: img,
          blobUrl: URL.createObjectURL(img),
        }))
        const imgNodes = imgEntries.map(({ file, blobUrl }) => ({
          type: 'image' as const,
          attrs: { src: blobUrl, alt: file.name },
        }))
        ed.chain().focus().insertContent(imgNodes).run()
        for (const { file, blobUrl } of imgEntries) {
          uploadAndInsert(ed, file, blobUrl)
        }
        $e('a:doc:image:upload', { source: 'drop', count: images.length })
      }

      // Batch-insert file attachment placeholder nodes in a single transaction
      if (nonImages.length) {
        const fileEntries = nonImages.map((file) => ({
          file,
          blobUrl: URL.createObjectURL(file),
        }))
        const fileNodes = fileEntries.map(({ file, blobUrl }) => ({
          type: 'fileAttachment' as const,
          attrs: { src: blobUrl, fileName: file.name, fileSize: file.size, fileType: file.type },
        }))
        ed.chain().focus().insertContent(fileNodes).run()
        for (const { file, blobUrl } of fileEntries) {
          uploadAndInsertFile(ed, file, blobUrl)
        }
        $e('a:doc:file:upload', { source: 'drop', count: nonImages.length })
      }

      return true
    },
    handlePaste(_view, event) {
      // Check for pasted files (images + non-images)
      const files = Array.from(event.clipboardData?.files || [])
      if (files.length) {
        const ed = editor.value
        if (!ed) return false

        const images = files.filter((f) => f.type.startsWith('image/'))
        const nonImages = files.filter((f) => !f.type.startsWith('image/'))

        event.preventDefault()

        if (images.length) {
          const imgEntries = images.map((img) => ({
            file: img,
            blobUrl: URL.createObjectURL(img),
          }))
          const imgNodes = imgEntries.map(({ file, blobUrl }) => ({
            type: 'image' as const,
            attrs: { src: blobUrl, alt: file.name },
          }))
          ed.chain().focus().insertContent(imgNodes).run()
          for (const { file, blobUrl } of imgEntries) {
            uploadAndInsert(ed, file, blobUrl)
          }
          $e('a:doc:image:upload', { source: 'paste', count: images.length })
        }

        if (nonImages.length) {
          const fileEntries = nonImages.map((file) => ({
            file,
            blobUrl: URL.createObjectURL(file),
          }))
          const fileNodes = fileEntries.map(({ file, blobUrl }) => ({
            type: 'fileAttachment' as const,
            attrs: { src: blobUrl, fileName: file.name, fileSize: file.size, fileType: file.type },
          }))
          ed.chain().focus().insertContent(fileNodes).run()
          for (const { file, blobUrl } of fileEntries) {
            uploadAndInsertFile(ed, file, blobUrl)
          }
          $e('a:doc:file:upload', { source: 'paste', count: nonImages.length })
        }

        return true
      }

      // Check if pasted text is a single embeddable URL — offer link vs embed choice
      const pastedUrl = event.clipboardData?.getData('text/plain')?.trim()
      if (pastedUrl && /^https?:\/\/\S+$/i.test(pastedUrl)) {
        const [plat, embUrl] = getEmbedURL(pastedUrl)
        if (plat !== 'unsupported' && embUrl !== 'unsupported') {
          event.preventDefault()
          const ed = editor.value
          if (ed) {
            // Set pending flag synchronously so the link hover preview is suppressed
            // before pasteLinkMenu.visible is set in the timeout
            isPasteLinkPending.value = true

            // Insert URL as linked text
            const from = ed.state.selection.from
            ed.chain()
              .focus()
              .insertContent({
                type: 'text',
                text: pastedUrl,
                marks: [{ type: 'link', attrs: { href: pastedUrl } }],
              })
              .run()
            const to = ed.state.selection.from

            // Position popup below the pasted link (viewport coords for fixed positioning)
            const coords = ed.view.coordsAtPos(to)

            // Delay showing the popup so the onUpdate triggered by insertContent
            // (which dismisses the menu) fires first before we set visible=true
            setTimeout(() => {
              isPasteLinkPending.value = false
              pasteLinkMenu.value = {
                visible: true,
                url: pastedUrl,
                platform: plat,
                embedUrl: embUrl,
                from,
                to,
                top: coords.bottom + 4,
                left: coords.left,
              }
            }, 0)
          }
          return true
        }
      }

      // If clipboard contains HTML (e.g. pasting from a browser / rich editor),
      // let Tiptap's default handler deal with it.
      const html = event.clipboardData?.getData('text/html')
      if (html) return false

      const text = event.clipboardData?.getData('text/plain')
      if (!text || !looksLikeMarkdown(text)) return false

      // Convert markdown → HTML, then insert via Tiptap's insertContent
      // (avoids raw ProseMirror replaceSelection which can corrupt state with open slices)
      const converted = DOMPurify.sanitize(marked.parse(text, { async: false }) as string)
      event.preventDefault()
      editor.value?.chain().focus().insertContent(converted).run()
      return true
    },
  },
  onUpdate: () => {
    // Dismiss paste-link menu on any editor content change (typing, etc.)
    if (pasteLinkMenu.value.visible) dismissPasteLinkMenu()
    debouncedSave()
    countTasks()
  },
  onSelectionUpdate: () => {
    onSelectionUpdate()
  },
})

// Sync the Tiptap-managed editor ref into our manually created ref
// so composables (declared above) can access the editor instance reactively.
watch(
  _tiptapEditor,
  (e) => {
    editor.value = e
  },
  { immediate: true },
)

// --- Derived state ---

const _createdByLabel = computed(() => resolveUserLabel(doc.value?.created_by))

const updatedByLabel = computed(() => resolveUserLabel(doc.value?.updated_by))

const staleUserLabel = computed(() => resolveUserLabel(staleUpdatedBy.value))

const updatedAgo = computed(() => {
  const ts = doc.value?.updated_at
  if (!ts) return ''
  return timeAgo(ts)
})

const wordCount = computed(() => {
  const text = editor.value?.state?.doc?.textContent
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
})

// --- Task list progress ---

const taskTotal = ref(0)

const taskCompleted = ref(0)

const hasTaskItems = computed(() => taskTotal.value > 0)

function countTasks() {
  if (!editor.value) return
  let total = 0
  let completed = 0
  editor.value.state.doc.descendants((node) => {
    if (node.type.name === 'taskItem') {
      total++
      if (node.attrs.checked) completed++
    }
  })
  taskTotal.value = total
  taskCompleted.value = completed
}

// Register the slash command upload triggers once the editor is available.
// The slash commands call editor.storage.{type}.openUpload() which we wire here.
watch(editor, (ed) => {
  if (ed?.storage?.image) {
    ed.storage.image.openUpload = async () => {
      const files = await openFilePicker({ multiple: true })
      if (!files.length) return

      // Insert all placeholder nodes in one transaction, then upload in parallel
      const blobEntries = files.map((file) => ({
        file,
        blobUrl: URL.createObjectURL(file),
      }))

      const nodes = blobEntries.map(({ file, blobUrl }) => ({
        type: 'image' as const,
        attrs: { src: blobUrl, alt: file.name },
      }))

      ed.chain().focus().insertContent(nodes).run()

      for (const { file, blobUrl } of blobEntries) {
        uploadAndInsert(ed, file, blobUrl)
      }
      $e('a:doc:image:upload', { source: 'slash-command', count: files.length })
    }
  }
  if (ed?.storage?.fileAttachment) {
    ed.storage.fileAttachment.openUpload = async () => {
      const files = await openFileAttachmentPicker({ multiple: true })
      if (!files.length) return

      // Insert all placeholder nodes in one transaction, then upload in parallel
      const blobEntries = files.map((file) => ({
        file,
        blobUrl: URL.createObjectURL(file),
      }))

      const nodes = blobEntries.map(({ file, blobUrl }) => ({
        type: 'fileAttachment' as const,
        attrs: { src: blobUrl, fileName: file.name, fileSize: file.size, fileType: file.type },
      }))

      ed.chain().focus().insertContent(nodes).run()

      // Upload each file and swap blob → permanent path
      for (const { file, blobUrl } of blobEntries) {
        uploadAndInsertFile(ed, file, blobUrl)
      }
      $e('a:doc:file:upload', { source: 'slash-command', count: files.length })
    }
  }
  if (ed?.storage?.embed) {
    ed.storage.embed.insertFromUrl = (editor: any, url: string) => {
      const [platform, embedUrl] = getEmbedURL(url.trim())
      if (platform === 'unsupported' || embedUrl === 'unsupported') {
        ncMessage.warning(t('msg.embedUrlNotSupported'))
        return
      }

      editor.chain().focus().insertEmbed({ src: embedUrl, url: url.trim(), platform }).run()
    }
  }
})

// Keep editor editable state in sync with the user's role.
// Roles may resolve asynchronously (e.g. after workspace/base data loads).
watch(isEditable, (val) => {
  if (editor.value) {
    editor.value.setEditable(val)
  }
})

const activeFont = ref<'default' | 'serif' | 'mono'>('default')

// Re-load doc when navigating between pages.
// Watch both docId AND activeProjectId — on a full page reload, activeProjectId
// may not be available yet when docId resolves from route params. Without this,
// loadDoc silently returns null (guard: !activeProjectId) and the editor stays empty.
watch(
  [docId, activeProjectId],
  async ([newId, newBaseId]) => {
    if (newId && newBaseId) {
      await loadAndSetDoc(newId)

      const loadedFont = docMeta.value.font
      activeFont.value = loadedFont === 'serif' || loadedFont === 'mono' ? loadedFont : 'default'

      nextTick(() => countTasks())

      // Auto-focus the title input on new (untitled) pages so the user
      // can immediately start typing a name (only for users who can edit).
      // On mobile, skip focus when the sidebar is open — the editor isn't visible
      // and focusing would trigger the virtual keyboard.
      const skipFocus = isMobileMode.value && isLeftSidebarOpen.value
      if (!title.value && isEditable.value && !skipFocus) {
        nextTick(() => {
          ;(titleInput.value as HTMLInputElement)?.focus()
        })
      }
    }
  },
  { immediate: true },
)

// Sync external title changes (e.g. sidebar rename) into the editor's local title ref.
// Skip when the editor itself initiated the change (isSaving) or when loading a new doc.
// Guard: only sync when activeDocument still matches the editor's local doc — during
// navigation activeDocument switches to the new page before loadAndSetDoc flushes
// the pending save, which would corrupt title.value with the wrong page's title.
watch(
  () => activeDocument.value?.title,
  (storeTitle) => {
    if (!storeTitle || isSaving.value || !isLoaded.value) return
    if (!doc.value || activeDocument.value?.id !== doc.value.id) return

    // Map the server default "Untitled" to empty (editor convention)
    const normalized = storeTitle === 'Untitled' ? '' : storeTitle

    if (normalized !== title.value) {
      title.value = normalized
      // Also sync the local doc ref so version/title stay consistent
      doc.value.title = storeTitle
    }
  },
)

const onTitleBlur = () => {
  if (!isEditable.value || !doc.value) return

  const effectiveTitle = title.value || 'Untitled'

  // Eagerly sync title to the store so the sidebar + URL slug update immediately.
  // Guard: only sync if activeDocument still matches the editor's doc (navigation may
  // have changed activeDocumentId before blur fires).
  if (effectiveTitle !== doc.value.title) {
    doc.value.title = effectiveTitle
  }
  if (activeDocument.value?.id === doc.value.id && effectiveTitle !== activeDocument.value?.title) {
    activeDocument.value!.title = effectiveTitle
  }

  // Compare against last-saved title to decide whether to persist.
  // We must compare against lastSavedTitle (not doc.value.title) because
  // debouncedTitleSync eagerly updates doc.value.title for sidebar/URL reactivity.
  if (effectiveTitle !== lastSavedTitle.value) {
    debouncedSave()
  }
}

// Eagerly sync title to sidebar + URL slug while the user types (debounced).
// This mirrors the content auto-save pattern — the sidebar updates in near-real-time
// without waiting for blur.  Also triggers a save so typing + waiting persists the rename.
const debouncedTitleSync = useDebounceFn(() => {
  if (!isLoaded.value || !doc.value) return

  const effectiveTitle = title.value || 'Untitled'
  if (effectiveTitle !== doc.value.title) {
    doc.value.title = effectiveTitle
  }
  // Guard: only sync to store if activeDocument still matches the editor's doc
  if (activeDocument.value?.id === doc.value.id && effectiveTitle !== activeDocument.value?.title) {
    activeDocument.value!.title = effectiveTitle
  }
  // Trigger a save if the title differs from what was last persisted
  if (effectiveTitle !== lastSavedTitle.value) {
    debouncedSave()
  }
}, 500)

watch(title, () => {
  if (isLoaded.value) {
    debouncedTitleSync()
  }
})

const onTitleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    editor.value?.commands.focus('start')
  }
}

/**
 * When the user clicks in the empty padding area below all content blocks,
 * focus the editor and move cursor to the end of the document.
 * This makes it easy to append content after the last block (table, callout, etc.).
 */
const onEditorBodyClick = (e: MouseEvent) => {
  if (!editor.value || !isEditable.value) return

  const target = e.target as HTMLElement

  // Only handle clicks on the editor body wrapper itself — not on content inside it.
  // The ProseMirror content area (.ProseMirror) and table menus handle their own clicks.
  if (!target.classList.contains('nc-doc-editor-body')) return

  editor.value.commands.focus('end')
}

// --- Page context menu (3-dot) ---
const isPageMenuOpen = ref(false)

const onDuplicatePage = async () => {
  isPageMenuOpen.value = false
  if (!base.value?.id || !doc.value?.id) return

  const fullDoc = await loadDocument(doc.value.id, false)
  if (!fullDoc) return

  await createDocument(base.value.id, {
    title: t('labels.copyOfDocument', { title: fullDoc.title || t('general.untitled') }),
    content: fullDoc.content,
  })
}

const onToggleCommentsPanel = () => {
  toggleCommentsPanel()
  isPageMenuOpen.value = false
}

const isDeleteModalOpen = ref(false)

const onDeletePage = () => {
  isPageMenuOpen.value = false
  isDeleteModalOpen.value = true
}

const onPagePermissions = () => {
  isPageMenuOpen.value = false
  if (!base.value?.id) return

  const wsId = route.params.typeOrId
  navigateTo(`/${wsId}/${base.value.id}/settings/docs-permissions`)
}

const confirmDeletePage = async () => {
  if (!base.value?.id || !doc.value?.id) return
  await deleteDocument(base.value.id, doc.value.id)
}

const updateDocumentIcon = async (icon: string) => {
  if (!doc.value?.id || !base.value?.id) return
  try {
    doc.value.meta = {
      ...docMeta.value,
      icon,
    }

    const updated = await updateDocument(base.value.id, doc.value.id, {
      meta: doc.value.meta,
      version: doc.value.version,
    })

    // Sync version so subsequent saves don't fail with stale version
    if (updated?.version && doc.value) {
      doc.value.version = updated.version
    }

    $e('a:doc:icon:editor', { icon })
  } catch (e: any) {
    ncMessage.error(await extractSdkResponseErrorMsg(e))
  }
}

const coverImageSrc = computed(() => {
  const coverFileRefId = docMeta.value.cover_image_file_ref_id
  if (!coverFileRefId || !base.value?.id || !doc.value?.id) return ''
  return `${appInfo.value.ncSiteUrl}/api/v2/data/bases/${base.value.id}/docs/${doc.value.id}/attachment/${encodeURIComponent(
    coverFileRefId,
  )}`
})

const onAddOrChangeCover = async () => {
  if (!doc.value?.id || !base.value?.id) return

  const files = await openFilePicker()
  const file = files[0]
  if (!file) return

  try {
    const uploaded = await batchUploadFiles([file], 'noco/docs')
    if (!uploaded.length) return

    const storedRef = uploaded[0].path || uploaded[0].url
    if (!storedRef) return

    doc.value.meta = {
      ...docMeta.value,
      cover_image: storedRef,
    }

    const updated = await updateDocument(base.value.id, doc.value.id, {
      meta: doc.value.meta,
      version: doc.value.version,
    })

    if (updated && doc.value) {
      doc.value.version = updated.version
      // Backend injects cover_image_file_ref_id — sync it back
      if (updated.meta) {
        doc.value.meta = parseProp(updated.meta)
      }
    }

    $e('a:doc:cover:update')
  } catch (e: any) {
    ncMessage.error(await extractSdkResponseErrorMsg(e))
  }
}

const onRemoveCover = async () => {
  if (!doc.value?.id || !base.value?.id) return

  try {
    const meta = { ...docMeta.value }
    delete meta.cover_image
    delete meta.cover_image_file_ref_id

    doc.value.meta = meta

    const updated = await updateDocument(base.value.id, doc.value.id, {
      meta: doc.value.meta,
      version: doc.value.version,
    })

    if (updated && doc.value) {
      doc.value.version = updated.version
      if (updated.meta) {
        doc.value.meta = parseProp(updated.meta)
      }
    }

    $e('a:doc:cover:remove')
  } catch (e: any) {
    ncMessage.error(await extractSdkResponseErrorMsg(e))
  }
}

const isFullWidth = computed(() => docMeta.value.full_width === true)

const setDocFont = async (font: 'default' | 'serif' | 'mono') => {
  if (!doc.value?.id || !base.value?.id || font === activeFont.value) return
  activeFont.value = font
  try {
    doc.value.meta = { ...docMeta.value, font }
    const updated = await updateDocument(base.value.id, doc.value.id, {
      meta: doc.value.meta,
      version: doc.value.version,
    })
    if (updated?.version && doc.value) doc.value.version = updated.version
    $e('a:doc:font:change', { font })
  } catch (e: any) {
    ncMessage.error(await extractSdkResponseErrorMsg(e))
  }
}

const onCopyPageLink = () => {
  performCopyLink(() => copy(window.location.href))
}

const toggleFullWidth = async () => {
  if (!doc.value?.id || !base.value?.id) return
  const newVal = !isFullWidth.value
  try {
    doc.value.meta = { ...docMeta.value, full_width: newVal }
    const updated = await updateDocument(base.value.id, doc.value.id, {
      meta: doc.value.meta,
      version: doc.value.version,
    })
    if (updated?.version && doc.value) doc.value.version = updated.version
    $e('a:doc:full-width:toggle', { fullWidth: newVal })
  } catch (e: any) {
    ncMessage.error(await extractSdkResponseErrorMsg(e))
  }
  isPageMenuOpen.value = false
}

const onDownloadMarkdown = () => {
  isPageMenuOpen.value = false
  downloadMarkdown()
}

const onDownloadHTML = () => {
  isPageMenuOpen.value = false
  downloadHTML()
}

const onDownloadPDF = () => {
  isPageMenuOpen.value = false

  if (showUpgradeToUseDocsExportPdf()) {
    return
  }

  downloadPDF()
}

// Dismiss paste-link menu and link edit popover on click outside
const onDocClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  // Close link edit popover
  if (isLinkEditOpen.value && !target.closest('.nc-link-edit-popover')) {
    closeLinkEdit()
  }

  // Close link hover preview
  if (isLinkHoverVisible.value && !target.closest('.nc-link-hover-preview') && !target.closest('a[href]')) {
    dismissLinkHover()
  }

  if (!pasteLinkMenu.value.visible) return
  if (target.closest('.nc-paste-link-menu')) return
  dismissPasteLinkMenu()
}
onMounted(() => document.addEventListener('click', onDocClick, true))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick, true))

// Setup link hover listeners on editor content container
const editorContentRef = ref<HTMLElement | null>(null)

// Position is derived from getBoundingClientRect which doesn't trigger Vue reactivity
// on scroll. Use a ref updated explicitly when hover/edit state changes.
const linkHoverStyle = ref<Record<string, string>>({ display: 'none' })

const updateLinkHoverPosition = () => {
  if (!linkHoverEl.value || (!isLinkHoverVisible.value && !isLinkEditOpen.value)) {
    linkHoverStyle.value = { display: 'none' }
    return
  }
  const rect = linkHoverEl.value.getBoundingClientRect()
  const containerRect = editorContentRef.value?.getBoundingClientRect()
  if (!containerRect) {
    linkHoverStyle.value = { display: 'none' }
    return
  }
  linkHoverStyle.value = {
    position: 'absolute',
    top: `${rect.bottom - containerRect.top + 4}px`,
    left: `${rect.left - containerRect.left}px`,
    zIndex: '50',
  }
}

watch([isLinkHoverVisible, isLinkEditOpen], updateLinkHoverPosition)

// Resolve internal page links to their document for hover display
const linkHoverPage = computed(() => resolvePageFromUrl(linkHoverUrl.value))

const isLinkCopiedTooltip = ref(false)
const onCopyLinkUrl = async () => {
  await copyLinkUrl()
  isLinkCopiedTooltip.value = true
  setTimeout(() => {
    isLinkCopiedTooltip.value = false
  }, 1500)
}

let cleanupHoverListeners: (() => void) | undefined

watch(editorContentRef, (el, _oldEl, onCleanup) => {
  if (el) {
    cleanupHoverListeners = setupLinkHover(el)
    onCleanup(() => {
      cleanupHoverListeners?.()
      cleanupHoverListeners = undefined
    })
  }
})

onBeforeUnmount(() => {
  cleanupHoverListeners?.()
  cleanupLinkHover()
})

// Intercept Cmd/Ctrl+F at document level so it works even when the editor
// doesn't have focus (e.g. cursor is in the title input or page body).
const onDocKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
    e.preventDefault()
    if (isSearchOpen.value) {
      nextTick(() => searchBarRef.value?.focusSearch())
    } else {
      isSearchOpen.value = true
    }
  }
}
onMounted(() => document.addEventListener('keydown', onDocKeydown, true))
onBeforeUnmount(() => document.removeEventListener('keydown', onDocKeydown, true))

watch(
  () => pasteLinkMenu.value.visible,
  (visible) => {
    if (visible) pasteLinkActiveIndex.value = 0
  },
)

// --- Sticky header: show when title scrolls out of view ---
let titleObserver: IntersectionObserver | null = null

watch(
  [titleInput, scrollContainerRef],
  ([titleEl, scrollEl]) => {
    titleObserver?.disconnect()
    titleObserver = null

    if (!titleEl || !scrollEl) return

    titleObserver = new IntersectionObserver(
      ([entry]) => {
        isTitleVisible.value = entry.isIntersecting
      },
      { root: scrollEl, rootMargin: '-48px 0px 0px 0px', threshold: 1 },
    )
    titleObserver.observe(titleEl)
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  titleObserver?.disconnect()
  titleObserver = null
  flushOnUnmount()
  editor.value?.destroy()
})
</script>

<template>
  <!-- Show skeleton only on initial load (no doc fetched yet) -->
  <DocEditorSkeleton v-if="!isLoaded && !doc" />

  <!-- Document not found or not accessible -->
  <div v-else-if="isLoaded && !doc" class="flex flex-col items-center justify-center h-full gap-4 text-nc-content-gray-subtle">
    <GeneralIcon icon="ncFileText" class="w-16 h-16 text-nc-content-gray-muted" />
    <div class="text-lg font-semibold text-nc-content-gray-emphasis">
      {{ $t('msg.info.pageNotFound') }}
    </div>
    <div class="text-sm">
      {{ $t('msg.info.pageNotFoundDescription') }}
    </div>
    <div class="text-sm text-nc-content-gray-muted">
      {{ $t('msg.info.pageNotFoundHint') }}
    </div>
  </div>

  <!--
    Keep the editor mounted across page switches to avoid detaching
    ProseMirror's view from the DOM. Content is swapped via setContent.
  -->
  <div v-else class="nc-doc-editor flex flex-row h-full w-full overflow-hidden">
    <!-- Editor area — relative wrapper for floating menu + scroll content -->
    <div class="relative flex-1 min-w-0 h-full overflow-hidden">
      <!-- Sticky header background — slides in when title scrolls out of view -->
      <Transition name="nc-doc-sticky-slide">
        <div v-if="!isTitleVisible && isLoaded" class="nc-doc-sticky-header" />
      </Transition>

      <!-- Breadcrumb — always visible, same pattern as page menu -->
      <div class="nc-doc-page-menu-left">
        <GeneralOpenLeftSidebarBtn />

        <DocBreadcrumb v-if="isLoaded" :doc-id="docId" :current-title="title" />
      </div>

      <!-- Page actions — always visible at top-right -->
      <div class="nc-doc-page-menu">
        <DocPresence />
        <NcTooltip :title="$t('general.comments')" placement="bottom" class="flex">
          <NcButton
            size="small"
            type="text"
            :class="{ '!bg-nc-bg-brand-soft': isCommentsPanelOpen }"
            @click="toggleCommentsPanel()"
          >
            <GeneralIcon icon="ncMessageCircle" :class="isCommentsPanelOpen ? 'text-nc-content-brand' : ''" />
          </NcButton>
        </NcTooltip>
        <NcDropdown v-model:visible="isPageMenuOpen" placement="bottomRight" class="flex">
          <NcButton size="small" type="secondary" @click.stop="isPageMenuOpen = !isPageMenuOpen">
            <GeneralIcon icon="threeDotVertical" />
          </NcButton>
          <template #overlay>
            <NcMenu variant="small" class="!min-w-52">
              <NcMenuItemCopyId
                v-if="doc"
                :id="doc.id"
                v-e="['c:document:copy-id']"
                :tooltip="$t('labels.copyDocumentId')"
                :label="`DOCUMENT ID: ${doc.id}`"
                data-testid="nc-doc-page-copy-id"
              />
              <div :key="activeFont" class="nc-doc-font-selector" data-testid="nc-doc-font-selector" @click.stop>
                <button
                  v-for="f in (['default', 'serif', 'mono'] as const)"
                  :key="f"
                  v-e="['c:doc:font:change', { font: f }]"
                  class="nc-doc-font-option"
                  :class="{ 'nc-doc-font-option-active': activeFont === f }"
                  @click="setDocFont(f)"
                >
                  <span class="nc-doc-font-preview" :class="`nc-doc-font-preview-${f}`">Ag</span>
                  <span class="nc-doc-font-label">{{ $t(`labels.font${f.charAt(0).toUpperCase() + f.slice(1)}`) }}</span>
                </button>
              </div>
              <NcDivider />
              <NcMenuItem v-e="['c:doc:copy-link']" @click="onCopyPageLink">
                <GeneralIcon class="text-nc-content-gray-subtle" :icon="isLinkCopied ? 'check' : 'link'" />
                {{ isLinkCopied ? $t('general.copied') : $t('activity.copyLink') }}
              </NcMenuItem>
              <NcMenuItem v-if="isUIAllowed('documentCreate')" @click="onDuplicatePage">
                <GeneralIcon class="text-nc-content-gray-subtle" icon="duplicate" />
                {{ $t('general.duplicate') }}
              </NcMenuItem>
              <NcMenuItem v-e="['c:doc:comments:toggle']" @click="onToggleCommentsPanel">
                <GeneralIcon class="text-nc-content-gray-subtle" icon="ncMessageCircle" />
                {{ $t('general.comments') }}
              </NcMenuItem>
              <NcMenuItem v-e="['c:doc:full-width:toggle']" @click="toggleFullWidth">
                <GeneralIcon class="text-nc-content-gray-subtle" icon="ncMoveHorizontal" />
                {{ isFullWidth ? $t('labels.exitFullWidth') : $t('labels.fullWidth') }}
              </NcMenuItem>
              <NcMenuItem
                v-if="isCreatorOrAbove"
                v-e="['c:doc:permissions']"
                data-testid="nc-doc-page-permissions"
                @click="onPagePermissions"
              >
                <GeneralIcon class="text-nc-content-gray-subtle" icon="ncLock" />
                {{ $t('title.pagePermissions') }}
              </NcMenuItem>
              <NcDivider />
              <NcSubMenu key="download" variant="small">
                <template #title>
                  <GeneralIcon class="text-nc-content-gray-subtle" icon="download" />
                  {{ $t('general.downloadAs') }}
                </template>
                <NcMenuItem @click="onDownloadMarkdown">
                  <GeneralIcon icon="ncHash" />
                  {{ $t('general.markdown') }}
                </NcMenuItem>
                <NcMenuItem @click="onDownloadHTML">
                  <GeneralIcon icon="code" />
                  {{ $t('general.html') }}
                </NcMenuItem>
                <NcMenuItem inner-class="w-full" @click="onDownloadPDF">
                  <GeneralIcon icon="pdfFile" />
                  <span class="flex-1">
                    {{ $t('general.pdf') }}
                  </span>
                  <PaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_DOCS_EXPORT_PDF" class="-mr-1" remove-click />
                </NcMenuItem>
              </NcSubMenu>
              <NcDivider />
              <NcMenuItem v-if="isUIAllowed('documentDelete')" danger @click="onDeletePage">
                <GeneralIcon icon="delete" />
                {{ $t('general.delete') }}
              </NcMenuItem>
              <NcDivider />
              <div class="nc-doc-menu-info">
                <span>{{ $t('labels.wordCount', { count: wordCount }) }}</span>
                <span v-if="updatedByLabel">{{ $t('labels.lastEditedBy', { user: updatedByLabel }) }}</span>
                <span v-if="updatedAgo">{{ updatedAgo }}</span>
              </div>
            </NcMenu>
          </template>
        </NcDropdown>
      </div>

      <!-- Search & Replace bar — floats at top-right above editor content -->
      <DocSearchReplace
        v-if="isSearchOpen && editor"
        ref="searchBarRef"
        class="nc-doc-search-below-sticky"
        :editor="editor"
        @close="isSearchOpen = false"
      />

      <!-- Scroll area for editor content -->
      <div
        ref="scrollContainerRef"
        class="flex flex-col h-full overflow-y-auto nc-scrollbar-thin"
        :class="`nc-doc-font-${activeFont}`"
      >
        <div
          v-if="isStale"
          class="nc-doc-stale-banner w-full mx-auto px-6 sm:px-10 lg:px-16 pt-[var(--topbar-height)]"
          :class="{ 'max-w-[900px]': !isFullWidth }"
        >
          <NcAlert type="info" :closable="false" align="center" class="!bg-nc-bg-brand">
            <template #message>
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm">
                  {{ staleUserLabel ? $t('msg.documentUpdatedByUser', { user: staleUserLabel }) : $t('msg.documentUpdated') }}
                </span>
                <NcButton size="small" type="secondary" @click="reloadDocument">
                  {{ $t('general.reload') }}
                </NcButton>
              </div>
            </template>
          </NcAlert>
        </div>

        <!-- Cover image banner -->
        <div v-if="coverImageSrc" class="nc-doc-cover group relative w-full" data-testid="nc-doc-cover">
          <img :src="coverImageSrc" class="nc-doc-cover-image" />
          <div v-if="isEditable" class="nc-doc-cover-controls">
            <NcButton size="xsmall" type="secondary" data-testid="nc-doc-cover-change" @click="onAddOrChangeCover">
              {{ $t('labels.changeCover') }}
            </NcButton>
            <NcButton size="xsmall" type="secondary" data-testid="nc-doc-cover-remove" @click="onRemoveCover">
              {{ $t('labels.removeCover') }}
            </NcButton>
          </div>
        </div>

        <div class="nc-doc-editor-inner w-full mx-auto px-6 sm:px-10 lg:px-16" :class="{ 'max-w-[900px]': !isFullWidth }">
          <!-- Title -->
          <div class="nc-doc-editor-header pt-12 pb-4">
            <NcTooltip v-if="!coverImageSrc && isUIAllowed('documentUpdate')" :disabled="isEditable">
              <template #title>{{ $t('msg.info.editingRestrictedForThisPage') }}</template>
              <div
                class="nc-doc-add-cover"
                :class="{ 'opacity-40 pointer-events-none': !isEditable }"
                data-testid="nc-doc-add-cover"
                @click="isEditable && onAddOrChangeCover()"
              >
                <GeneralIcon icon="ncImage" class="!w-3.5 !h-3.5" />
                {{ $t('labels.addCover') }}
              </div>
            </NcTooltip>
            <div class="nc-doc-title-row flex items-center">
              <NcTooltip :disabled="isEditable" class="flex-shrink-0">
                <template #title>{{ $t('msg.info.editingRestrictedForThisPage') }}</template>
                <div class="nc-doc-editor-icon-wrapper" data-testid="nc-doc-opened-page-icon-picker">
                  <LazyGeneralEmojiPicker
                    :key="docMeta?.icon"
                    :clearable="true"
                    :emoji="docMeta?.icon"
                    :readonly="!isEditable"
                    class="nc-doc-editor-icon"
                    size="large"
                    @emoji-selected="updateDocumentIcon($event)"
                  >
                    <template #default>
                      <GeneralIcon class="nc-doc-editor-icon-default text-nc-content-gray-muted !w-7 !h-7" icon="ncFileText" />
                    </template>
                  </LazyGeneralEmojiPicker>
                </div>
              </NcTooltip>
              <input
                ref="titleInput"
                v-model="title"
                :readonly="!isEditable"
                class="nc-doc-title w-full text-3xl font-semibold outline-none bg-transparent nc-doc-title-input"
                data-testid="docs-page-title"
                :placeholder="$t('general.untitled')"
                @blur="onTitleBlur"
                @keydown="onTitleKeydown"
              />
            </div>
            <div class="nc-doc-subtitle flex items-center mt-2 text-sm">
              <span v-if="updatedByLabel && updatedAgo">
                {{ $t('general.updatedBy') }} {{ updatedByLabel }} {{ updatedAgo }}
              </span>
              <span v-if="isSaving">{{ $t('general.saving') }}...</span>
              <span v-if="hasTaskItems" class="nc-doc-task-progress">
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--nc-border-gray-medium)" stroke-width="2" />
                  <circle
                    cx="7"
                    cy="7"
                    r="5.5"
                    fill="none"
                    stroke="var(--nc-fill-primary)"
                    stroke-width="2"
                    stroke-linecap="round"
                    :stroke-dasharray="2 * Math.PI * 5.5"
                    :stroke-dashoffset="2 * Math.PI * 5.5 * (1 - (taskTotal ? taskCompleted / taskTotal : 0))"
                    transform="rotate(-90 7 7)"
                  />
                </svg>
                {{ $t('labels.taskProgress', { completed: taskCompleted, total: taskTotal }) }}
              </span>
              <span v-e="['c:doc:comments:subtitle-toggle']" class="nc-doc-subtitle-comments" @click="toggleCommentsPanel()">
                <GeneralIcon icon="ncMessageCircle" class="!w-3.5 !h-3.5" />
                <template v-if="commentCount">
                  {{ commentCount }} {{ commentCount === 1 ? $t('general.comment') : $t('general.comments') }}
                </template>
                <template v-else>
                  {{ $t('general.comment') }}
                </template>
              </span>
            </div>
          </div>

          <!-- Editor — always mounted so ProseMirror view stays attached -->
          <div class="nc-doc-editor-body pb-48 relative" data-testid="docs-page-content" @click="onEditorBodyClick">
            <template v-if="editor">
              <!-- Bubble menu: appears on text selection (including inside table cells) -->
              <BubbleMenu
                :editor="editor"
                :update-delay="250"
                :tippy-options="{ duration: 100, maxWidth: 'none' }"
                :should-show="showRichTextMenu"
              >
                <!-- Formatting toolbar + custom link button -->
                <div class="nc-doc-bubble-toolbar flex items-center">
                  <CellRichTextSelectedBubbleMenu
                    :editor="editor"
                    embed-mode
                    hide-mention
                    :hidden-options="[
                      RichTextBubbleMenuOptions.link,
                      RichTextBubbleMenuOptions.image,
                      RichTextBubbleMenuOptions.table,
                    ]"
                    class="!px-0"
                  />
                  <NcTooltip placement="top">
                    <template #title>{{ $t('general.link') }}</template>
                    <NcButton
                      size="small"
                      type="text"
                      :class="{ 'is-active': editor.isActive('link') }"
                      :disabled="editor.isActive('codeBlock')"
                      @click="openLinkInput"
                    >
                      <GeneralIcon icon="link2" />
                    </NcButton>
                  </NcTooltip>
                  <NcTooltip placement="top">
                    <template #title>{{ $t('tooltip.addComment') }}</template>
                    <NcButton
                      v-if="isEditable"
                      size="small"
                      type="text"
                      data-testid="nc-doc-comment-add-btn"
                      @mousedown.prevent
                      @click="onAddInlineComment"
                    >
                      <GeneralIcon icon="comment" />
                    </NcButton>
                  </NcTooltip>
                </div>
              </BubbleMenu>

              <div ref="editorContentRef" class="relative">
                <EditorContent :editor="editor" @click="onEditorClick" />

                <!-- Link hover preview (Notion-style) -->
                <div
                  v-if="isLinkHoverVisible && !isLinkEditOpen"
                  :style="linkHoverStyle"
                  class="nc-link-hover-preview"
                  @mouseenter="keepLinkHoverAlive"
                  @mouseleave="hideLinkHover"
                >
                  <template v-if="linkHoverPage">
                    <span v-if="parseProp(linkHoverPage.meta)?.icon" class="nc-link-hover-icon">
                      {{ parseProp(linkHoverPage.meta).icon }}
                    </span>
                    <GeneralIcon v-else icon="ncFileText" class="nc-link-hover-icon text-nc-content-gray-subtle" />
                    <span class="nc-link-hover-url truncate">{{ linkHoverPage.title || $t('general.untitled') }}</span>
                  </template>
                  <template v-else>
                    <GeneralIcon icon="globe" class="nc-link-hover-icon" />
                    <span class="nc-link-hover-url truncate">{{ linkHoverUrl }}</span>
                  </template>
                  <NcTooltip :title="isLinkCopiedTooltip ? $t('general.copied') : $t('general.copy')" placement="top">
                    <GeneralIcon
                      :icon="isLinkCopiedTooltip ? 'check' : 'copy'"
                      class="nc-link-hover-action"
                      @click="onCopyLinkUrl"
                    />
                  </NcTooltip>
                  <span v-if="isEditable" class="nc-link-hover-edit" @click="openLinkEdit">{{ $t('general.edit') }}</span>
                </div>

                <!-- Link edit popover -->
                <div v-if="isLinkEditOpen" :style="linkHoverStyle" class="nc-link-edit-popover" @mouseenter="keepLinkHoverAlive">
                  <div class="nc-link-edit-field">
                    <label class="nc-link-edit-label">{{ $t('labels.pageOrUrl') }}</label>
                    <input
                      ref="linkEditInputRef"
                      v-model="linkEditUrl"
                      class="nc-link-edit-input"
                      :placeholder="$t('placeholder.enterALink')"
                      @keydown="onLinkEditUrlKeyDown"
                    />
                    <!-- Heading (section) suggestion dropdown -->
                    <div v-if="headingSuggestions.length" class="nc-link-page-suggestions">
                      <div
                        v-for="(heading, idx) in headingSuggestions"
                        :key="heading.slug"
                        class="nc-link-page-suggestion-item"
                        :class="{ 'is-selected': idx === headingSuggestionIndex }"
                        @click="selectHeadingSuggestion(heading)"
                        @mouseenter="headingSuggestionIndex = idx"
                      >
                        <span class="nc-link-heading-level text-nc-content-gray-subtle">H{{ heading.level }}</span>
                        <span class="nc-link-page-suggestion-title truncate">{{ heading.title }}</span>
                      </div>
                    </div>
                    <!-- Page suggestion dropdown -->
                    <div v-else-if="pageSuggestions.length" class="nc-link-page-suggestions">
                      <template v-for="(page, idx) in pageSuggestions" :key="page.id">
                        <div
                          class="nc-link-page-suggestion-item"
                          :class="{ 'is-selected': idx === pageSuggestionIndex }"
                          @click="selectPageSuggestion(page)"
                          @mouseenter="pageSuggestionIndex = idx"
                        >
                          <span v-if="parseProp(page.meta)?.icon" class="nc-link-page-suggestion-icon">{{
                            parseProp(page.meta).icon
                          }}</span>
                          <GeneralIcon
                            v-else
                            icon="ncFileText"
                            class="nc-link-page-suggestion-icon text-nc-content-gray-subtle"
                          />
                          <span class="nc-link-page-suggestion-title truncate">{{ page.title || $t('general.untitled') }}</span>
                          <GeneralLoader
                            v-if="isLoadingPageHeadings && expandedPageId === page.id"
                            size="small"
                            class="nc-link-page-section-chevron"
                          />
                          <GeneralIcon
                            v-else
                            :icon="expandedPageId === page.id ? 'chevronDown' : 'chevronRight'"
                            class="nc-link-page-section-chevron text-nc-content-gray-subtle"
                            @click.stop="togglePageSections(page)"
                          />
                        </div>
                        <!-- Expanded sections for this page -->
                        <template v-if="expandedPageId === page.id">
                          <div
                            v-for="heading in expandedPageHeadings"
                            :key="heading.slug"
                            class="nc-link-page-suggestion-item nc-link-page-section-item"
                            @click="selectPageHeadingSuggestion(page, heading)"
                          >
                            <span class="nc-link-heading-level text-nc-content-gray-subtle">H{{ heading.level }}</span>
                            <span class="nc-link-page-suggestion-title truncate">{{ heading.title }}</span>
                          </div>
                          <div
                            v-if="!isLoadingPageHeadings && expandedPageHeadings.length === 0"
                            class="nc-link-page-section-item nc-link-edit-hint text-nc-content-gray-subtle"
                          >
                            {{ $t('labels.noResults') }}
                          </div>
                        </template>
                      </template>
                    </div>
                    <!-- No matching results for page or heading search -->
                    <div v-else-if="hasNoSuggestions" class="nc-link-edit-hint text-nc-content-gray-subtle">
                      {{ $t('labels.noResults') }}
                    </div>
                    <!-- Hint for anchor link shortcut (only when not searching) -->
                    <div v-else class="nc-link-edit-hint text-nc-content-gray-subtle">
                      {{ $t('tooltip.typeHashToLinkSection') }}
                    </div>
                  </div>
                  <div class="nc-link-edit-field">
                    <label class="nc-link-edit-label">{{ $t('labels.linkTitle') }}</label>
                    <input
                      v-model="linkEditTitle"
                      class="nc-link-edit-input"
                      :placeholder="$t('placeholder.enterTitle')"
                      @keydown.enter.prevent="saveLinkEdit"
                      @keydown.escape.prevent="closeLinkEdit"
                    />
                  </div>
                  <div class="nc-link-edit-divider" />
                  <div class="nc-link-edit-remove" @click="deleteLinkEdit">
                    <GeneralIcon icon="delete" />
                    <span>{{ $t('labels.removeLink') }}</span>
                  </div>
                </div>
              </div>

              <!-- Table context menus: column/row handles + dropdown menus (hidden for read-only users) -->
              <DocTableMenu v-if="isEditable" :editor="editor" />
            </template>
          </div>
        </div>

        <!-- Delete page modal — matches table delete styling -->
        <GeneralDeleteModal v-model:visible="isDeleteModalOpen" entity-name="Page" :on-delete="confirmDeletePage">
          <template #entity-preview>
            <div
              class="flex flex-row items-center py-2.25 px-2.5 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle"
            >
              <GeneralIcon icon="ncFileText" class="text-nc-content-gray-subtle" />
              <div
                class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
                :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
              >
                {{ title || $t('general.untitled') }}
              </div>
            </div>
          </template>
        </GeneralDeleteModal>

        <!-- Paste link embed popup — teleported to body to avoid style interference -->
        <Teleport to="body">
          <div
            v-if="pasteLinkMenu.visible"
            class="nc-paste-link-menu"
            :style="{ top: `${pasteLinkMenu.top}px`, left: `${pasteLinkMenu.left}px` }"
          >
            <div class="nc-paste-link-item" :class="{ active: pasteLinkActiveIndex === 0 }" @click="keepAsLink">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="flex-shrink-0 text-nc-content-gray-subtle"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span>{{ $t('general.keepAsLink') }}</span>
            </div>
            <div class="nc-paste-link-item" :class="{ active: pasteLinkActiveIndex === 1 }" @click="convertToEmbed">
              <span
                v-if="embedPlatformIcons[pasteLinkMenu.platform]"
                class="nc-paste-link-platform-icon flex-shrink-0"
                v-html="embedPlatformIcons[pasteLinkMenu.platform]"
              />
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="flex-shrink-0 text-nc-content-gray-subtle"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none" />
              </svg>
              <span>{{ $t('general.embed') }}</span>
            </div>
          </div>
        </Teleport>
      </div>
      <!-- /scroll area -->
    </div>
    <!-- /relative wrapper -->

    <!-- Comments sidebar — drawer on mobile, inline panel on desktop -->
    <NcDrawer
      v-if="isMobileMode"
      v-model:visible="isCommentsPanelOpen"
      height="85svh"
      :show-drag-handle="true"
      :swipe-to-close="true"
      :scrollable-body="false"
      body-class-name="!p-0"
    >
      <DocCommentsSidebar
        :doc-id="docId"
        :base-id="base?.id"
        :editor="editor"
        :pending-selection="pendingInlineCommentSelection"
        class="!w-full !h-full !border-l-0"
        @close="isCommentsPanelOpen = false"
        @clear-pending-selection="pendingInlineCommentSelection = null"
      />
    </NcDrawer>
    <DocCommentsSidebar
      v-else-if="isCommentsPanelOpen"
      :doc-id="docId"
      :base-id="base?.id"
      :editor="editor"
      :pending-selection="pendingInlineCommentSelection"
      @close="isCommentsPanelOpen = false"
      @clear-pending-selection="pendingInlineCommentSelection = null"
    />
  </div>
</template>

<style lang="scss">
.nc-doc-editor {
  background: var(--nc-bg-default);
  // Definite height so inner overflow-y-auto activates and only the editor content scrolls.
  // The h-full chain breaks at a-layout-content — this bypasses it.
  height: 100vh;
  height: 100dvh;
}

// Doc editor bubble menu — override embed-mode's transparent/no-shadow defaults
// and tighten horizontal spacing to keep the toolbar compact.
.nc-doc-editor-body .bubble-menu.embed-mode,
.nc-doc-editor-body .nc-doc-bubble-toolbar .bubble-menu.embed-mode {
  @apply !rounded-lg !rounded-r-none !gap-x-0;
  border: 1px solid var(--nc-border-gray-medium) !important;
  border-right: 0 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;

  // Shrink buttons from 32px (small) to 28px for a tighter toolbar
  .nc-button.ant-btn {
    @apply !h-7 !min-w-7 !px-1 !py-0.5 !mt-0;
  }

  // Reduce divider height to match smaller buttons
  .divider {
    @apply !h-7;
  }
}

// Wrapper for formatting toolbar + link button
.nc-doc-editor-body .nc-doc-bubble-toolbar {
  @apply flex items-center bg-nc-bg-default rounded-lg px-0.5 py-0.5;
  gap: 0;
  border: 1px solid var(--nc-border-gray-medium);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

  // Match the 28px size used inside .bubble-menu.embed-mode so
  // link + comment buttons are the same size as formatting buttons
  .nc-button.ant-btn {
    @apply !h-7 !min-w-7 !px-1 !py-0.5;
  }
  // overflow: visible so the highlight color picker dropdown (positioned
  // absolutely below the toolbar) is not clipped.
  overflow: visible;

  > .bubble-menu.embed-mode {
    @apply !rounded-lg !rounded-r-none;
    border: none !important;
    box-shadow: none !important;
  }
}

// Link input bubble menus
.nc-doc-editor-body .nc-doc-link-input {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

  .nc-button {
    @apply !my-auto;
  }
}

// --- Link hover preview (Notion-style) ---
.nc-link-hover-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--nc-bg-default);
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  max-width: 400px;
  font-size: 13px;
  white-space: nowrap;
}

.nc-link-hover-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--nc-content-gray-muted);
}

.nc-link-hover-url {
  color: var(--nc-content-gray);
  min-width: 0;
}

.nc-link-hover-action {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  cursor: pointer;
  color: var(--nc-content-gray-muted);

  &:hover {
    color: var(--nc-content-gray);
  }
}

.nc-link-hover-edit {
  flex-shrink: 0;
  cursor: pointer;
  color: var(--nc-content-gray-muted);
  font-weight: 500;
  padding-left: 4px;
  border-left: 1px solid var(--nc-border-gray-medium);

  &:hover {
    color: var(--nc-content-gray);
  }
}

// --- Link edit popover ---
.nc-link-edit-popover {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: var(--nc-bg-default);
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  width: 300px;
  font-size: 13px;
}

.nc-link-edit-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.nc-link-edit-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--nc-content-gray-muted);
}

.nc-link-edit-input {
  padding: 6px 10px;
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 6px;
  background: var(--nc-bg-default);
  color: var(--nc-content-gray);
  font-size: 13px;
  outline: none;

  &:focus {
    border-color: var(--nc-fill-primary);
  }
}

// --- Page suggestion dropdown ---
.nc-link-page-suggestions {
  margin-top: 4px;
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 6px;
  background: var(--nc-bg-default);
  max-height: 200px;
  overflow-y: auto;
}

.nc-link-page-suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  transition: background-color 0.1s ease;

  &.is-selected,
  &:hover {
    background-color: var(--nc-bg-gray-light);
  }
}

.nc-link-page-suggestion-icon {
  flex-shrink: 0;
  width: 16px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nc-link-page-suggestion-title {
  font-size: 13px;
  color: var(--nc-content-gray);
  line-height: 1.3;
}

.nc-link-page-section-chevron {
  flex-shrink: 0;
  margin-left: auto;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
  }
}

.nc-link-page-section-item {
  padding-left: 28px;
}

.nc-link-heading-level {
  flex-shrink: 0;
  width: 20px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
}

.nc-link-edit-hint {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.3;
  padding: 0 2px;
}

.nc-link-edit-divider {
  height: 1px;
  background: var(--nc-border-gray-medium);
  margin-bottom: 8px;
}

.nc-link-edit-remove {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 2px;
  cursor: pointer;
  color: var(--nc-content-gray-muted);
  border-radius: 4px;

  &:hover {
    color: var(--nc-content-red-dark);
  }
}

// Page actions — floats at top-right of editor area, outside scroll flow
.nc-doc-page-menu {
  @apply h-[var(--topbar-height)] flex items-center gap-2 absolute top-0 right-3 z-20;
}

.nc-doc-page-menu-left {
  @apply h-[var(--topbar-height)] flex items-center gap-1 absolute top-0 left-3 z-20 truncate;

  right: 120px;
  overflow: hidden;
}
// Sticky header backdrop — slides in on scroll, sits behind breadcrumb + actions
.nc-doc-sticky-header {
  @apply absolute top-0 left-0 right-0  h-[var(--topbar-height)];

  z-index: 18;
  background: color-mix(in srgb, var(--nc-bg-default) 85%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--nc-border-gray-medium);
}

.nc-doc-sticky-slide-enter-active,
.nc-doc-sticky-slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.nc-doc-sticky-slide-enter-from,
.nc-doc-sticky-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

// Push search bar below sticky header when it's visible
.nc-doc-search-bar.nc-doc-search-below-sticky {
  top: 56px !important;
}

// Icon positioned to the left, outside the content bounds on large screens.
// On small screens it sits inline with a small gap.
.nc-doc-editor-icon-wrapper {
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 4px;

  @media (min-width: 1024px) {
    margin-left: -48px;
    margin-right: 8px;
  }
}

// Subtitle metadata row — dot separators between items
.nc-doc-subtitle {
  color: var(--nc-content-gray-muted);

  > span + span::before {
    content: '\00B7';
    margin: 0 6px;
  }
}

// Task list progress indicator (inline with subtitle metadata)
.nc-doc-task-progress {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

// Comment indicator in subtitle — clickable to toggle comment sidebar
.nc-doc-subtitle-comments {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  border-radius: 4px;
  padding: 0 4px;

  &:hover {
    color: var(--nc-content-brand);
  }
}

// Title placeholder — lighter than muted to feel like a watermark
.nc-doc-title-input::placeholder {
  color: var(--nc-content-gray-muted);
  opacity: 1;
}

// Drag handle — positioned absolutely inside .nc-doc-editor-body (which has position: relative)
.nc-doc-drag-handle {
  position: absolute;
  display: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  cursor: grab;
  border-radius: 4px;
  color: var(--nc-content-gray-muted);
  transition: opacity 0.15s ease, color 0.15s ease;
  z-index: 10;
  user-select: none;

  &:hover {
    background: var(--nc-bg-gray-light);
    color: var(--nc-content-gray-subtle);
  }

  &:active {
    cursor: grabbing;
  }

  svg {
    width: 16px;
    height: 16px;
  }
}

// Drop indicator line shown between blocks during drag-and-drop reorder
.nc-doc-drop-indicator {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--nc-border-gray-medium);
  border-radius: 1px;
  display: none;
  z-index: 10;
  pointer-events: none;
}

// Column ratio toolbar — positioned absolutely inside .nc-doc-editor-body (same as drag handle)
.nc-columns-toolbar {
  position: absolute;
  display: none;
  gap: 2px;
  background: var(--nc-bg-default);
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 6px;
  padding: 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  z-index: 10;
  user-select: none;

  button {
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 4px 6px;
    border: none;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;

    &:hover {
      background: var(--nc-bg-gray-light);
    }

    &.active {
      background: var(--nc-bg-brand);
    }

    .bar {
      height: 14px;
      border-radius: 2px;
      background: currentColor;
    }

    &.active .bar {
      color: var(--nc-content-brand);
    }

    &:not(.active) .bar {
      color: var(--nc-content-gray-muted);
    }
  }
}

// Doc editor typography — no prose class, clean styles
.nc-doc-editor-content.ProseMirror {
  // Highlight marks — keep text colour from parent, match native selection height
  mark {
    color: inherit;
    padding: 2px 0;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }

  min-height: 200px;
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--nc-content-gray);

  ::selection {
    background: color-mix(in srgb, var(--nc-fill-primary) 35%, transparent);
  }

  // Dark mode: pastel highlight backgrounds are barely visible on dark bg.
  // Use dark text so the coloured mark creates readable contrast (like Notion).
  // Hardcoded because all semantic text tokens map to light colours in dark mode.
  html.dark & mark[data-color] {
    color: #1f2937;
  }

  > * {
    margin-top: 0;
    margin-bottom: 0;
  }

  > * + * {
    margin-top: 9px;
  }

  // Headings — H1/H2/H3 prefix labels and collapse chevrons sit outside
  // via absolute positioning. Labels are bottom-aligned with the first line
  // of heading text so they sit on the same baseline regardless of heading
  // font size. Only visible when the editor is focused — hidden when the
  // cursor is in the title input or elsewhere outside the editor.
  //
  // Three states:
  //   Expanded + not hovered → "H1"/"H2"/"H3" text label
  //   Expanded + hovered     → ▼ down chevron (click to collapse)
  //   Collapsed (always)     → ▶ right chevron (click to expand)
  h1,
  h2,
  h3 {
    position: relative;
    color: var(--nc-content-gray-emphasis);

    &::before {
      position: absolute;
      right: 100%;
      // padding (not margin) so the ::before box touches the heading's left edge —
      // eliminates the hover dead zone when moving horizontally from text to chevron.
      padding-right: 0.5em;
      color: var(--nc-content-gray-muted);
      font-size: 12px;
      font-weight: 500;
    }
  }

  h1 {
    font-size: 1.625em;
    font-weight: 600;
    margin-top: 1.4em;
    margin-bottom: 0.4em;
    line-height: 1.3;
  }

  h2 {
    font-size: 1.3em;
    font-weight: 600;
    margin-top: 1.2em;
    margin-bottom: 0.35em;
    line-height: 1.35;
  }

  h3 {
    font-size: 1.125em;
    font-weight: 600;
    margin-top: 1em;
    margin-bottom: 0.3em;
    line-height: 1.4;
  }

  // Collapsed heading: remove bottom margin (section is hidden)
  h1.nc-heading-collapsed,
  h2.nc-heading-collapsed,
  h3.nc-heading-collapsed {
    margin-bottom: 0;
  }

  // Hidden section content
  .nc-heading-section-hidden {
    display: none !important;
  }

  // Chevron shared properties — 24px = 16px icon (pinned left via mask-position) + 8px gap.
  // Base padding-right: 0.5em (from h1/h2/h3 ::before above) bridges hover to heading edge.
  // Per-heading `top` aligns to baseline: font-size * line-height - 16px - 2px.
  h1.nc-heading-collapsed::before,
  h2.nc-heading-collapsed::before,
  h3.nc-heading-collapsed::before {
    content: '';
    width: 24px;
    height: 16px;
    display: inline-block;
    background-color: var(--nc-content-gray-muted);
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='currentColor'%3E%3Cpolygon points='6,3 12,8 6,13'/%3E%3C/svg%3E");
    mask-size: 16px 16px;
    mask-position: left center;
    mask-repeat: no-repeat;
    cursor: pointer;
  }
  h1.nc-heading-collapsed::before {
    top: calc(1.625em * 1.3 - 16px - 2px);
  }
  h2.nc-heading-collapsed::before {
    top: calc(1.3em * 1.35 - 16px - 2px);
  }
  h3.nc-heading-collapsed::before {
    top: calc(1.125em * 1.4 - 16px - 2px);
  }

  // --- Expanded state (editor focused): text labels + hover chevrons ---
  &.ProseMirror-focused {
    // Text labels — hidden for the heading with the cursor and for collapsed headings
    h1:not(.nc-heading-collapsed):not(.nc-heading-has-cursor)::before {
      content: 'H1';
      top: calc(1.625em * 1.3 - 12px - 2px);
    }
    h2:not(.nc-heading-collapsed):not(.nc-heading-has-cursor)::before {
      content: 'H2';
      top: calc(1.3em * 1.35 - 12px - 2px);
    }
    h3:not(.nc-heading-collapsed):not(.nc-heading-has-cursor)::before {
      content: 'H3';
      top: calc(1.125em * 1.4 - 12px - 2px);
    }

    // Hover: replace label with down chevron (▼)
    h1:not(.nc-heading-collapsed):hover::before,
    h2:not(.nc-heading-collapsed):hover::before,
    h3:not(.nc-heading-collapsed):hover::before {
      content: '';
      width: 24px;
      height: 16px;
      display: inline-block;
      background-color: var(--nc-content-gray-muted);
      mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='currentColor'%3E%3Cpolygon points='3,6 13,6 8,12'/%3E%3C/svg%3E");
      mask-size: 16px 16px;
      mask-position: left center;
      mask-repeat: no-repeat;
      cursor: pointer;
    }
    h1:not(.nc-heading-collapsed):hover::before {
      top: calc(1.625em * 1.3 - 16px - 2px);
    }
    h2:not(.nc-heading-collapsed):hover::before {
      top: calc(1.3em * 1.35 - 16px - 2px);
    }
    h3:not(.nc-heading-collapsed):hover::before {
      top: calc(1.125em * 1.4 - 16px - 2px);
    }

    // Blockquotes: no collapse support
    blockquote h1::before,
    blockquote h2::before,
    blockquote h3::before {
      content: none;
    }
  }

  // Heading anchor icon — inline after heading text, zero-width so it doesn't
  // affect text flow. Appears on heading hover right next to the last word.
  .nc-heading-anchor-icon {
    display: inline;
    width: 0;
    overflow: visible;
    opacity: 0;
    transition: opacity 0.15s ease;
    user-select: none;
    pointer-events: none;

    &::after {
      content: '';
      display: inline-block;
      width: 16px;
      height: 16px;
      margin-left: 6px;
      padding: 2px;
      vertical-align: middle;
      background-color: var(--nc-content-gray-disabled);
      mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='currentColor'%3E%3Cpath d='M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z'/%3E%3C/svg%3E");
      mask-size: 16px 16px;
      mask-repeat: no-repeat;
      cursor: pointer;
      pointer-events: auto;
      border-radius: 4px;
    }

    &:hover::after {
      background-color: var(--nc-content-brand);
    }
  }

  // Scale anchor icon proportionally to heading size
  h1 > .nc-heading-anchor-icon::after {
    vertical-align: baseline;
    position: relative;
    top: -0.1em;
  }

  h2 > .nc-heading-anchor-icon::after {
    width: 15px;
    height: 15px;
    mask-size: 15px 15px;
  }

  h3 > .nc-heading-anchor-icon::after {
    width: 14px;
    height: 14px;
    mask-size: 14px 14px;
  }

  h1:hover > .nc-heading-anchor-icon,
  h2:hover > .nc-heading-anchor-icon,
  h3:hover > .nc-heading-anchor-icon {
    opacity: 1;
  }

  // Scroll-target highlight — brief flash when scrolling to an anchored heading
  h1[data-heading-anchor]:target,
  h2[data-heading-anchor]:target,
  h3[data-heading-anchor]:target {
    animation: nc-heading-flash 1.5s ease;
  }

  // Active divider — show a selection border when a horizontal rule is selected
  hr.nc-active-block {
    outline: 1px solid var(--nc-fill-primary);
    outline-offset: 1px;
    border-radius: 2px;
  }

  // Drag-selected node outline — only shown while the drag handle is active.
  // Scoped to body.nc-doc-dragging to avoid overriding existing
  // ProseMirror-selectednode styles for images, embeds, etc.
  body.nc-doc-dragging & .ProseMirror-selectednode {
    outline: 2px solid var(--nc-fill-primary);
    outline-offset: 2px;
    border-radius: 4px;
  }

  // Search match highlight decorations (DocSearchExtension).
  // ProseMirror Decoration.inline creates <span> elements with these classes.
  // Inactive matches are yellow; the active/current match is orange.
  .nc-search-match {
    background: rgba(255, 212, 0, 0.4);
    border-radius: 2px;
  }

  .nc-search-match-active {
    background: rgba(255, 150, 0, 0.6);
    border-radius: 2px;
  }

  // Placeholder — shown on the focused empty paragraph (via Tiptap Placeholder extension)
  p.is-empty::before,
  p.is-editor-empty::before {
    content: attr(data-placeholder);
    float: left;
    color: var(--nc-content-gray-disabled);
    pointer-events: none;
    height: 0;
  }

  // Slash command inline placeholder — "Type to search" hint after "/"
  .nc-slash-placeholder {
    color: var(--nc-content-gray-disabled);
    pointer-events: none;
    user-select: none;
  }

  // Lists — distinct markers for the first 3 nesting levels,
  // then consistent dash (–) from level 4 onwards.
  ul {
    list-style-type: disc;
    padding-left: 1.5em;

    ul {
      list-style-type: circle;

      ul {
        list-style-type: square;

        ul {
          list-style-type: '–  ';
        }
      }
    }
  }

  ol {
    list-style-type: decimal;
    padding-left: 1.5em;
  }

  ul li,
  ol li {
    margin-top: 0.1em;
    margin-bottom: 0.1em;
  }

  ul li p,
  ol li p {
    margin-top: 0;
    margin-bottom: 0;
  }

  // Task lists — checkbox + text on a single row, no bullet marker
  ul[data-type='taskList'] {
    list-style: none;
    padding-left: 0;

    li {
      display: flex;
      flex-direction: row;
      align-items: baseline;
      margin-top: 0.1em;
      margin-bottom: 0.1em;

      > label {
        flex: 0 0 auto;
        margin-right: 0.4em;
        user-select: none;
        display: inline-flex;
        align-items: center;

        input[type='checkbox'] {
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
          margin: 0;
          position: relative;
          top: 0.1em;
          width: 16px;
          height: 16px;
          border: 2px solid var(--nc-content-gray-muted);
          border-radius: 4px;
          background: transparent;
          transition: background 0.15s, border-color 0.15s;

          &:checked {
            background: var(--nc-content-brand);
            border-color: var(--nc-content-brand);

            &::after {
              content: '';
              position: absolute;
              top: 1px;
              left: 4px;
              width: 5px;
              height: 8px;
              border: solid white;
              border-width: 0 2px 2px 0;
              border-radius: 0 0 1px 0;
              transform: rotate(45deg);
            }
          }
        }
      }

      > div {
        flex: 1 1 auto;
        min-width: 0;

        p {
          margin-top: 0;
          margin-bottom: 0;
        }
      }
    }

    // Checked (completed) task items — strikethrough + muted text
    li[data-checked='true'] > div {
      text-decoration: line-through;
      color: var(--nc-content-gray-muted);
      text-decoration-color: var(--nc-content-gray-disabled);
    }

    // Nested task lists
    ul[data-type='taskList'] {
      padding-left: 1.2em;
    }
  }

  // Blockquote
  blockquote {
    border-left: 3px solid var(--nc-bg-gray-extra-dark);
    padding-left: 1em;
    color: var(--nc-content-gray-subtle2);
    margin: 0.75em 0;
  }

  // Code — !important needed to override global `* { font-family: Inter }`
  code {
    background-color: var(--nc-bg-gray-medium);
    border-radius: 0.25em;
    padding: 0.15em 0.3em;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace !important;
    font-size: 0.875em;
  }

  // Code blocks — background/padding/border-radius handled by DocCodeBlockNode.vue.
  // Inline hljs token colours defined here (GitHub Dark–inspired theme).
  pre {
    code {
      background: none;
      padding: 0;
      color: inherit;
      font-size: inherit;
    }
  }

  // Syntax highlighting tokens (GitHub Dark)
  .hljs-doctag,
  .hljs-keyword,
  .hljs-meta .hljs-keyword,
  .hljs-template-tag,
  .hljs-template-variable,
  .hljs-type,
  .hljs-variable.language_ {
    color: #ff7b72;
  }

  .hljs-title,
  .hljs-title.class_,
  .hljs-title.class_.inherited__,
  .hljs-title.function_ {
    color: #d2a8ff;
  }

  .hljs-attr,
  .hljs-attribute,
  .hljs-literal,
  .hljs-meta,
  .hljs-number,
  .hljs-operator,
  .hljs-variable,
  .hljs-selector-attr,
  .hljs-selector-class,
  .hljs-selector-id {
    color: #79c0ff;
  }

  .hljs-regexp,
  .hljs-string,
  .hljs-meta .hljs-string {
    color: #a5d6ff;
  }

  .hljs-built_in,
  .hljs-symbol {
    color: #ffa657;
  }

  .hljs-comment,
  .hljs-code,
  .hljs-formula {
    color: #8b949e;
  }

  .hljs-name,
  .hljs-quote,
  .hljs-selector-tag,
  .hljs-selector-pseudo {
    color: #7ee787;
  }

  .hljs-subst {
    color: #c9d1d9;
  }

  .hljs-section {
    color: #1f6feb;
  }

  // Horizontal rule — centered line with vertical breathing room.
  // Uses a pseudo-element so the line sits in the vertical middle.
  hr {
    border: none;
    height: 1em;
    display: flex;
    align-items: center;

    &::after {
      content: '';
      display: block;
      width: 100%;
      border-top: 1px solid var(--nc-border-gray-medium);
    }
  }

  // Links — neutral color with subtle underline (Notion-style)
  a {
    color: inherit;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-decoration-color: var(--nc-border-gray-medium);
    text-underline-offset: 3px;
  }

  // Strikethrough — grey text and line (like Outline)
  s,
  del {
    color: var(--nc-content-gray-disabled);
    text-decoration-color: var(--nc-content-gray-disabled);
  }

  // Table — border-separate so border-radius works on corners
  table {
    border-collapse: separate;
    border-spacing: 0;
    margin: 20px 0 0 0;
    overflow: hidden;
    table-layout: fixed;
    width: 100%;
    border: 1px solid var(--nc-border-gray-medium);
    border-radius: 8px;

    td,
    th {
      border-right: 1px solid var(--nc-border-gray-medium);
      border-bottom: 1px solid var(--nc-border-gray-medium);
      box-sizing: border-box;
      min-width: 1em;
      padding: 6px 8px;
      position: relative;
      // Default vertical-align; overridden by inline style from verticalAlign attribute
      vertical-align: top;

      > * {
        margin-bottom: 0;
      }

      // Remove right border on last column (outer border handles it)
      &:last-child {
        border-right: none;
      }
    }

    // Remove bottom border on last row (outer border handles it)
    tr:last-child td,
    tr:last-child th {
      border-bottom: none;
    }

    th {
      background-color: var(--nc-bg-gray-light);
      font-weight: bold;
      text-align: left; // Override browser default (center) for <th>
    }

    // Round inner corners of corner cells to match outer radius
    tr:first-child th:first-child,
    tr:first-child td:first-child {
      border-top-left-radius: 7px;
    }
    tr:first-child th:last-child,
    tr:first-child td:last-child {
      border-top-right-radius: 7px;
    }
    tr:last-child td:first-child,
    tr:last-child th:first-child {
      border-bottom-left-radius: 7px;
    }
    tr:last-child td:last-child,
    tr:last-child th:last-child {
      border-bottom-right-radius: 7px;
    }

    // Selected cell highlight (Tiptap adds this class)
    .selectedCell::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
      background: color-mix(in srgb, var(--nc-fill-primary) 25%, transparent);
      pointer-events: none;
      z-index: 2;
    }
  }

  // File attachment cards
  .nc-file-attachment-wrapper {
    margin: 0.5em 0;
  }

  .nc-file-attachment-card {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: 1px solid var(--nc-border-gray-medium);
    border-radius: 8px;
    background: var(--nc-bg-gray-extralight);
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    max-width: 320px;
    position: relative;

    &:hover {
      border-color: var(--nc-bg-gray-dark);
      background: var(--nc-bg-gray-light);

      .nc-file-attachment-delete {
        opacity: 1;
      }
    }

    &.nc-file-attachment-selected {
      border-color: var(--nc-fill-primary);
      box-shadow: 0 0 0 1px var(--nc-fill-primary);
    }

    &.nc-file-attachment-uploading {
      opacity: 0.7;
      cursor: default;
    }
  }

  .nc-file-attachment-badge {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    padding: 4px 6px;
    border-radius: 4px;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .nc-file-attachment-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .nc-file-attachment-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--nc-content-gray);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nc-file-attachment-size {
    font-size: 11px;
    color: var(--nc-content-gray-muted);
    line-height: 1.3;
  }

  .nc-file-attachment-delete {
    flex-shrink: 0;
    opacity: 0;
    color: var(--nc-content-gray-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s, color 0.15s;

    &:hover {
      color: var(--nc-content-red-dark);
    }
  }

  .nc-file-attachment-spinner {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  // Embed (YouTube, Vimeo, etc.) cards
  .nc-embed-wrapper {
    margin: 0.75em 0;
  }

  .nc-embed-card {
    position: relative;
    border: 1px solid var(--nc-border-gray-medium);
    border-radius: 8px;
    overflow: hidden;
    background: white;

    :global(.dark) & {
      background: black;
    }
    transition: border-color 0.15s, box-shadow 0.15s;

    &:hover {
      border-color: var(--nc-bg-gray-dark);

      .nc-embed-delete {
        opacity: 1;
      }
    }

    &.nc-embed-selected {
      border-color: var(--nc-fill-primary);
      box-shadow: 0 0 0 1px var(--nc-fill-primary);
    }
  }

  .nc-embed-delete {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 2;
    opacity: 0;
    color: white;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s, background-color 0.15s;
    background: rgba(0, 0, 0, 0.5);
    border: none;

    &:hover {
      background: rgba(0, 0, 0, 0.7);
    }
  }

  .nc-embed-iframe-wrapper {
    position: relative;
    width: 100%;
    // padding-bottom (16:9 default) or height (user-resized) set via inline style
  }

  .nc-embed-iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;

    // User-resized embeds use static positioning (height is explicit)
    &.nc-embed-iframe-fixed {
      position: static;
    }
  }

  // Callout (notice) blocks
  .nc-callout {
    display: flex;
    gap: 10px;
    border-radius: 8px;
    padding: 12px 14px;
    margin: 0.75em 0;
    border-left: 4px solid;

    .nc-callout-icon {
      flex-shrink: 0;
      user-select: none;
      display: flex;
      align-items: center;
      // Match the first line height of editor content (0.95rem × 1.7)
      height: calc(0.95rem * 1.7);
      width: 18px;
      background-repeat: no-repeat;
      background-position: center;
      background-size: 18px 18px;
    }

    .nc-callout-content {
      flex: 1;
      min-width: 0;

      > *:first-child {
        margin-top: 0;
      }
      > *:last-child {
        margin-bottom: 0;
      }
    }

    // Each callout type: background color, border, and icon via CSS data URI
    &.nc-callout-note {
      background: var(--nc-bg-coloured-blue);
      border-left-color: var(--nc-content-blue-medium);

      .nc-callout-icon {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='16' x2='12' y2='12'/%3E%3Cline x1='12' y1='8' x2='12.01' y2='8'/%3E%3C/svg%3E");
      }
    }

    &.nc-callout-warning {
      background: var(--nc-bg-coloured-yellow);
      border-left-color: var(--nc-content-yellow-medium);

      .nc-callout-icon {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='%23f59e0b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/%3E%3Cline x1='12' y1='9' x2='12' y2='13'/%3E%3Cline x1='12' y1='17' x2='12.01' y2='17'/%3E%3C/svg%3E");
      }
    }

    &.nc-callout-tip {
      background: var(--nc-bg-coloured-green);
      border-left-color: var(--nc-content-green-medium);

      .nc-callout-icon {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='%2322c55e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 20h10'/%3E%3Cpath d='M10 20c5.5-2.5.8-6.4 3-10'/%3E%3Cpath d='M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z'/%3E%3Cpath d='M14.1 6a7 7 0 0 0-1.1-3c1.9.5 3.3 1.6 4.4 3.1a12.3 12.3 0 0 1 2 5.6c-2-.8-3.5-1.8-4.5-3.2a9 9 0 0 1-.8-2.5z'/%3E%3C/svg%3E");
      }
    }

    &.nc-callout-important {
      background: var(--nc-bg-coloured-red);
      border-left-color: var(--nc-content-red-medium);

      .nc-callout-icon {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='12'/%3E%3Cline x1='12' y1='16' x2='12.01' y2='16'/%3E%3C/svg%3E");
      }
    }
  }

  // 2-Column layout
  .nc-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin: 0.75em 0;

    .nc-column {
      min-width: 0; // prevent grid blowout from long content

      > *:first-child {
        margin-top: 0;
      }
      > *:last-child {
        margin-bottom: 0;
      }
    }
  }

  // @mention pills — mirrors .nc-rich-text .mention in style.scss
  .mention {
    @apply font-semibold rounded-md px-1 inline;

    &.nc-current-user {
      @apply bg-[#D4F7E0] text-[#17803D] dark:(bg-nc-bg-gray-medium text-green-500);
    }

    &:not(.nc-current-user) {
      @apply bg-nc-bg-brand-inverted text-nc-content-brand;
    }

    > span:first-child {
      display: none;
    }
  }
}

// Paste link embed popup
.nc-paste-link-menu {
  position: fixed;
  z-index: 9999;
  background: var(--nc-bg-default);
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 8px;
  padding: 4px 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  min-width: 160px;
}

.nc-paste-link-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  cursor: pointer;
  font-size: 13px;
  color: var(--nc-content-gray);

  &:hover,
  &.active {
    background-color: var(--nc-bg-gray-light);
  }
}

.nc-paste-link-platform-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;

  :deep(svg) {
    width: 16px;
    height: 16px;
  }
}

// Document comment marks
.nc-doc-comment-mark {
  background-color: rgba(var(--rgb-color-brand-100), 0.4);
  border-bottom: 2px solid rgb(var(--rgb-color-brand-300));
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover,
  &.active {
    background-color: rgba(var(--rgb-color-brand-200), 0.6);
  }

  // Flash animation when navigating from sidebar reference text click
  &.nc-doc-comment-mark-flash {
    animation: comment-mark-flash 1.5s ease-out forwards;
  }
}

@keyframes comment-mark-flash {
  0% {
    background-color: rgba(var(--rgb-color-brand-300), 0.7);
  }
  40% {
    background-color: rgba(var(--rgb-color-brand-300), 0.7);
  }
  100% {
    background-color: rgba(var(--rgb-color-brand-100), 0.4);
  }
}

// Cover image
.nc-doc-cover {
  height: 240px;
  min-height: 240px;
  flex-shrink: 0;
  overflow: hidden;
  margin-top: var(--topbar-height);
}

.nc-doc-cover-image {
  width: 100%;
  height: 240px;
  object-fit: cover;
  object-position: center;
}

.nc-doc-cover-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s;

  .group:hover & {
    opacity: 1;
  }

  .nc-button.ant-btn {
    padding: 0 8px !important;
    font-size: 11px;
    height: 22px !important;
    min-height: 22px !important;
    min-width: unset !important;
  }
}

.nc-doc-add-cover {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--nc-content-gray-muted);
  opacity: 0;
  transition: opacity 0.15s;

  &:hover {
    background: var(--nc-bg-gray-light);
    color: var(--nc-content-gray);
  }

  .nc-doc-editor-header:hover & {
    opacity: 1;
  }
}

// Document font variants — applied on the scroll container so title + editor inherit
// Target element AND all descendants with * to beat the global `* { font-family: Inter }` reset
.nc-doc-font-serif {
  .nc-doc-title-input {
    font-family: Georgia, 'Times New Roman', Times, serif !important;
  }

  .nc-doc-editor-content.ProseMirror,
  .nc-doc-editor-content.ProseMirror * {
    font-family: Georgia, 'Times New Roman', Times, serif !important;
  }
}

.nc-doc-font-mono {
  .nc-doc-title-input {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace !important;
  }

  .nc-doc-editor-content.ProseMirror,
  .nc-doc-editor-content.ProseMirror * {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace !important;
  }
}

// Font selector row in page menu
.nc-doc-font-selector {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
}

.nc-doc-font-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
  padding: 6px 4px;
  border-radius: 6px;
  border: 1px solid var(--nc-border-gray-medium);
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--nc-bg-gray-light);
  }

  &.nc-doc-font-option-active {
    border-color: var(--nc-content-brand);

    .nc-doc-font-label {
      color: var(--nc-content-brand);
    }
  }
}

.nc-doc-font-preview {
  font-size: 20px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--nc-content-gray);

  &.nc-doc-font-preview-serif {
    font-family: Georgia, 'Times New Roman', Times, serif;
  }

  &.nc-doc-font-preview-mono {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  }
}

.nc-doc-font-label {
  font-size: 11px;
  color: var(--nc-content-gray-subtle);
}

.nc-doc-menu-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--nc-content-gray-subtle2);
}

// Heading anchor scroll-target flash animation (must be at top level for SCSS)
@keyframes nc-heading-flash {
  0%,
  30% {
    background: color-mix(in srgb, var(--nc-fill-primary) 15%, transparent);
    border-radius: 4px;
  }
  100% {
    background: transparent;
  }
}

// Global cursor override during drag-handle reorder.
// Applied to body so the cursor stays consistent even when moving
// over iframes, images, or other elements that set their own cursor.
body.nc-doc-dragging,
body.nc-doc-dragging .nc-doc-editor-inner,
body.nc-doc-dragging .nc-doc-editor-inner * {
  cursor: grabbing !important;
}
</style>
