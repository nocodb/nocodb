<script setup lang="ts">
import { PermissionEntity, PermissionKey, PlanFeatureTypes } from 'nocodb-sdk'
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu, EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { prosemirrorJSONToYDoc } from 'y-prosemirror'
import TaskList from '@tiptap/extension-task-list'
import TableRow from '@tiptap/extension-table-row'
import { Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state'
import { CellSelection } from '@tiptap/pm/tables'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import type { DocHeadingEntry } from '../../composables/useDocHeadingAnchors'
import { DocHighlightExtension } from './DocHighlightExtension'
import { DocTextColorExtension } from './DocTextColorExtension'
import { DocCommentMarkExtension } from './DocCommentMarkExtension'
import { DocImageExtension } from './DocImageExtension'
import { DocFileAttachmentExtension } from './DocFileAttachmentExtension'
import { DocEmbedExtension } from './DocEmbedExtension'
import { DocWebBookmarkExtension } from './DocWebBookmarkExtension'
import type { WebBookmarkMetadata } from './DocWebBookmarkExtension'
import { DocCodeBlockExtension } from './DocCodeBlockExtension'
import { DocTable, DocTableCell, DocTableHeader } from './DocTableExtensions'
import { SlashCommandExtension, embedPlatformIcons } from './SlashCommand'
import { CalloutExtension } from './CalloutExtension'
import { DocColumnExtension, DocColumnsExtension } from './DocColumnsExtension'
import { DocTabExtension, DocTabsExtension } from './DocTabsExtension'
import { DocColumnsToolbarExtension } from './DocColumnsToolbarPlugin'
import { DocMathExtension } from './DocMathExtension'
import { DocActiveBlockExtension } from './DocActiveBlockPlugin'
import { DocBlockDirExtension } from './DocBlockDirPlugin'
import { DocHeadingCollapseExtension } from './DocHeadingCollapseExtension'
import { DocHeadingAnchorExtension } from './DocHeadingAnchorExtension'
import { DocDragHandleExtension } from './DocDragHandlePlugin'
import { DocSearchExtension } from './DocSearchExtension'
import { DocAiExtension, insertMarkdownContent } from './DocAiExtension'
import { CELL_BG_COLORS, TEXT_COLORS, buildColorCssVars } from './DocColorConstants'
import { getEmbedURL } from '~/extensions/url-preview-ee/utils'
import { TaskItem } from '~/helpers/tiptap-markdown/extensions/nodes/task-item'
import { UserMention, UserMentionList } from '~/helpers/tiptap-markdown/extensions/nodes/mention'
import { suggestion } from '~/helpers/tiptap'

const props = withDefaults(
  defineProps<{
    /**
     * Doc page id. Required in `mode = 'doc'`. Ignored in `mode = 'cell'`,
     * where the editor is driven by `initialContent` instead of loading
     * from the docs store.
     */
    docId?: string
    embedded?: boolean
    /**
     * `'doc'` (default): full page editor — loads + auto-saves a document
     * via the documents store; renders title, cover, comments, breadcrumb.
     * `'cell'`: SmartText cell editor — no doc load/save, no title/cover;
     * content is provided via `initialContent` and changes emit
     * `update:content`. The parent owns persistence.
     */
    mode?: 'doc' | 'cell'
    /** Initial PM JSON for cell mode. Re-applied when the prop reference changes. */
    initialContent?: Record<string, any> | null
    /** Force editor non-editable regardless of role / doc permissions (e.g. locked / shared views). */
    readOnly?: boolean
    /**
     * Opt into the heading marker rail while `embedded`. Non-embedded docs
     * always get it; embedded consumers (SmartText) don't — except the public
     * share reader, which sets this to render anchors + surface the heading
     * model so it can mount the rail against its own external scroller.
     */
    headingRail?: boolean
    /**
     * External scroll viewport for scroll-spy / scroll-to-heading. Used with
     * `headingRail` when the editor's internal scroller is flattened and the
     * page owns the scroll container (public share reader). Defaults to the
     * editor's own internal scroll area.
     */
    scrollContainer?: HTMLElement | null
  }>(),
  { docId: '', embedded: false, mode: 'doc', initialContent: null, readOnly: false, headingRail: false, scrollContainer: null },
)

const emit = defineEmits<{
  (e: 'update:content', content: Record<string, any>): void
}>()

const isCellMode = computed(() => props.mode === 'cell')

const docId = toRef(props, 'docId')

provide(DocIdInj, docId)

const basesStore = useBases()
const { activeProjectId, basesUser } = storeToRefs(basesStore)

const documentsStore = useDocumentsStore()
const { createDocument, deleteDocument, loadDocument, updateDocument } = documentsStore

const { $e, $api } = useNuxtApp()
const { user, appInfo, isMobileMode, isLeftSidebarOpen } = useGlobal()

const { showShareModal } = storeToRefs(useShare())

const { blockDocShare, showUpgradeToShareDoc, showUpgradeToUseDocumentPermissions } = useEeConfig()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

// --- Yjs collaborative editing ---
// Single source of truth for whether real-time collab is active. OFF for: CE
// (isEeUI false), cell mode (SmartText / public reader), the NC_DOCS_REALTIME
// kill-switch (appInfo.docsRealtimeEnabled), and any mount where the
// doc/workspace/base ids aren't resolvable synchronously at setup. When false
// the editor behaves exactly as before (legacy debounced REST save).
const collabEnabled =
  isEeUI &&
  props.mode === 'doc' &&
  appInfo.value.docsRealtimeEnabled !== false &&
  !!docId.value &&
  !!activeProjectId.value &&
  !!activeWorkspaceId.value &&
  !!user.value?.id

const collabUser = collabEnabled
  ? {
      id: user.value!.id,
      name: user.value?.display_name || user.value?.email || 'Anonymous',
      // Same per-user color as the presence avatars (see usePresence).
      color: getConsistentColor(user.value!.id),
    }
  : null

// Owns the Y.Doc + Awareness lifecycle and the socket sync handshake. Created
// once at setup (the ids are resolved synchronously above). Teardown is handled
// by the composable's own onScopeDispose.
const collab = collabEnabled
  ? useDocumentCollab({
      docId: docId.value,
      workspaceId: activeWorkspaceId.value!,
      baseId: activeProjectId.value!,
      user: collabUser!,
    })
  : null

const collabSynced = collab?.synced ?? ref(false)

// Whether Yjs owns the body. Provided for descendant node views and passed to
// this component's own upload composables explicitly (a component can't inject a
// key it provides itself); in collab mode they create the FileReference eagerly,
// since the REST reconcile that normally does it on save is skipped.
const collabActive = ref(collabEnabled)

provide(DocCollabActiveInj, collabActive)

// Track whether we've already seeded a legacy doc's PM JSON into the Y.Doc this
// session, so the bootstrap watch runs at most once.
let hasBootstrapped = false

// Page context menu (3-dot) open state
const isPageMenuOpen = ref(false)

const openShareModal = () => {
  // Close the page menu first so it doesn't sit behind the share dialog
  // (the menu is anchored to the topbar and would otherwise overlap the
  // upper-right of the modal). Matches the pattern used by the download /
  // full-width / delete handlers below.
  isPageMenuOpen.value = false
  // Gate public-share behind license/plan: unlicensed On-Prem (and CE,
  // which never reaches this since the button is hidden) routes to the
  // upgrade modal instead of opening the share dialog.
  if (showUpgradeToShareDoc({ triggerSource: 'doc-share' })) return
  showShareModal.value = true
}

const { isDark } = useTheme()

const docColorVars = computed(() => buildColorCssVars(isDark.value))
const { t } = useI18n()
const { isUIAllowed } = useRoles()
const { isAllowed: isPermissionAllowed } = usePermissions()
const { openFilePicker, uploadAndInsert } = useDocumentImageUpload({ collabActive, docId })
const { batchUploadFiles } = useAttachment()
const { openFilePicker: openFileAttachmentPicker, uploadAndInsert: uploadAndInsertFile } = useDocumentFileUpload({
  collabActive,
  docId,
})

const { activeDocuments } = storeToRefs(documentsStore)

const hasSubDocuments = computed(
  () =>
    activeDocuments.value.find((d) => d.id === docId.value)?.has_children ||
    activeDocuments.value.some((d) => d.parent_id === docId.value),
)

const base = inject(ProjectInj, ref())

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
const isEditable = computed(() => !props.readOnly && isUIAllowed('documentUpdate') && isDocEditAllowed.value)

/**
 * Title input read-only gate. Mirrors the body editor: in collab mode the title
 * stays read-only until the shared Y.Doc has synced, so a keystroke can't land in
 * the local Y.Text before the binding adopts the server's title (which would
 * otherwise merge into a duplicated title once sync arrives).
 */
const isTitleReadonly = computed(() => !isEditable.value || (collabEnabled && !collabSynced.value))

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

// In cell mode the editor is driven by `initialContent` + an `update:content`
// emit — no document load/save. We provide a shape-compatible stub so the
// rest of this component (title/cover/comments/version chrome, all template
// references to doc/title/isSaving/etc.) keeps working without per-callsite
// branches. In doc mode the real composable runs.
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
} = isCellMode.value
  ? (() => {
      const cellDoc = ref<any>({ id: 'cell', title: '', meta: {} })
      const noop = () => {}
      const noopAsync = async () => {}
      return {
        doc: cellDoc,
        title: ref(''),
        lastSavedTitle: ref(''),
        isSaving: ref(false),
        isLoaded: ref(true),
        isStale: computed(() => false),
        staleUpdatedBy: computed(() => null),
        debouncedSave: noop as () => void,
        loadAndSetDoc: noopAsync as (_id: string) => Promise<void>,
        reloadDocument: noopAsync as () => Promise<any>,
        flushOnUnmount: noop as () => void,
        activeDocument: ref<any>(null),
      }
    })()
  : useDocumentAutoSave({ editor, activeProjectId, isEditable, collabActive })

// Unsaved-changes safety net — mirrors the SmartTextPanel/Modal pattern.
// `flushOnUnmount` already runs on component unmount (covers SPA navigation),
// but the browser tears down the in-flight XHR if the tab is closed or
// backgrounded before a pending debounced save fires. Hooking `beforeunload`
// + `visibilitychange` triggers the same flush so the user doesn't lose the
// last few seconds of edits to a destroyed request. Doc mode only — cell
// mode is wrapped by SmartTextPanel/Modal which have their own listeners,
// and `flushOnUnmount` is a no-op in that branch anyway. `flushOnUnmount`
// self-guards (only fires when a save is actually pending) so unconditional
// calls here are cheap.
if (!isCellMode.value) {
  useEventListener(window, 'beforeunload', () => flushOnUnmount())
  useEventListener(document, 'visibilitychange', () => {
    if (document.hidden) flushOnUnmount()
  })
}

// Force a content reload after a revision restore. The auto-reload watcher
// in useDocumentAutoSave bails out when the user has unsaved edits or a
// pending debounced save, which would leave the editor's local PM state
// stale — the next autosave would then overwrite the restored content with
// whatever was in the editor before the restore.
// `onRestored` returns an `{ off }` handle from createEventHook. The hook
// lives for the lifetime of the singleton composable, so dropping the
// handle would leak a listener on every doc navigation (Editor.vue
// remounts via <NuxtPage>).
const { onRestored, registerCollabRestore } = useDocRevisions()
const restoredSub = onRestored(({ docId }) => {
  if (docId === doc.value?.id) {
    reloadDocument()
  }
})
onBeforeUnmount(() => restoredSub.off())

// In collab mode REST restores are rejected by the live-doc coherence gate, so
// the revision panel delegates the restore to us: applying the snapshot through
// the editor lets the Collaboration extension convert it into Yjs ops that
// propagate to peers and persist via the server-authoritative path. (The
// `onRestored` → reloadDocument path above only fires for non-collab REST
// restores, which don't trigger this branch.)
if (collabEnabled) {
  const stopCollabRestore = registerCollabRestore((content, restoredTitle) => {
    editor.value?.commands.setContent(content)
    if (collabTitle && typeof restoredTitle === 'string') {
      collabTitle.setTitle(restoredTitle === 'Untitled' ? '' : restoredTitle)
    }
  })
  onBeforeUnmount(stopCollabRestore)
}

// Live collaborative title. In collab mode the title lives in the shared Y.Doc
// (a Y.Text), so it co-edits in real time like the body. `patchStoreTitle` keeps
// the documents store (sidebar / breadcrumb / URL slug) in sync as the title
// changes locally or remotely — replacing the REST-save-driven sync that runs in
// non-collab mode (disabled below while collab is active).
function patchStoreTitle(normalized: string) {
  if (!doc.value) return
  if (normalized !== doc.value.title) doc.value.title = normalized
  if (activeDocument.value?.id === doc.value.id && normalized !== activeDocument.value?.title) {
    activeDocument.value!.title = normalized
  }
}

const collabTitle =
  collabEnabled && collab
    ? useCollabTitle({
        ydoc: collab.ydoc,
        title,
        getInputEl: () => titleInput.value as HTMLInputElement | null,
        onTitle: patchStoreTitle,
      })
    : undefined

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

const { downloadMarkdown, downloadHTML, downloadPDF } = useDocumentExport({
  editor,
  title,
  imageUrlBuilder: (fileRefId: string) => {
    const baseId = base.value?.id
    const docIdVal = doc.value?.id
    if (!baseId || !docIdVal) return ''
    return `${appInfo.value.ncSiteUrl}/api/v2/data/bases/${baseId}/docs/${docIdVal}/attachment/${encodeURIComponent(fileRefId)}`
  },
})

// Non-embedded docs always get the heading rail; embedded consumers (SmartText)
// don't, except the public share reader which opts in via `headingRail`.
const isHeadingRailEnabled = !props.embedded || props.headingRail

// When the page supplies an external scroll viewport (public share, where the
// editor's own scroller is flattened) spy/scroll target it; otherwise the
// editor's internal scroll area.
const effectiveScrollRef = computed(() => props.scrollContainer ?? scrollContainerRef.value)

const {
  scrollToHeading,
  headings: docHeadings,
  activeHeadingId,
} = isHeadingRailEnabled
  ? useDocHeadingAnchors(editor, effectiveScrollRef, isLoaded)
  : {
      scrollToHeading: (_id: string) => false,
      headings: ref<DocHeadingEntry[]>([]),
      activeHeadingId: ref<string | null>(null),
    }

const { copy } = useCopy()

const { isCopied: isLinkCopied, performCopy: performCopyLink } = useIsCopied(2000)

// --- Document AI ---
const { aiWrite, aiContinue, aiImprove, aiSummarize, aiTranslate, docAiLoading, abortCurrentRequest } = useDocumentAi()
const { isAiFeaturesEnabled, aiIntegrationAvailable } = useNocoAi()
const { blockDocAi, showUpgradeToUseDocAi } = useEeConfig()

const isDocAiConfigured = computed(() => isAiFeaturesEnabled.value && aiIntegrationAvailable.value)

const docAiTranslateLanguages = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Italian',
  'Dutch',
  'Russian',
  'Chinese, Simplified',
  'Chinese, Traditional',
  'Japanese',
  'Korean',
  'Arabic',
  'Hebrew',
  'Indonesian',
  'Vietnamese',
  'Filipino',
]

const docAiTones = ['Professional', 'Casual', 'Straightforward', 'Confident', 'Friendly']

/**
 * Extract plain text from the current ProseMirror doc (for AI context).
 * For "continue writing", takes from the end. For general context, takes
 * a mix of the beginning and the end to give the AI better orientation.
 */
const getDocPlainText = (maxChars = 2000, fromEnd = true) => {
  if (!editor.value) return ''
  const text = editor.value.state.doc.textContent
  if (text.length <= maxChars) return text
  if (fromEnd) return text.slice(-maxChars)
  const headLen = Math.min(500, Math.floor(maxChars / 4))
  return `${text.slice(0, headLen)}\n...\n${text.slice(-(maxChars - headLen))}`
}

/** If the AI returns ProseMirror JSON instead of Markdown, extract the text content.
 *  This is a safety net — the prompt should prevent it, but edge cases exist. */
const sanitizeAiResponse = (text: string): string => {
  const trimmed = text.trim()
  // Detect JSON array or object with ProseMirror-like node structures
  if (
    (trimmed.startsWith('[') || trimmed.startsWith('{')) &&
    /"type"\s*:\s*"(heading|paragraph|text|taskList|taskItem|callout|bulletList|orderedList|codeBlock|blockquote)"/.test(trimmed)
  ) {
    try {
      const parsed = JSON.parse(trimmed.startsWith('[') ? trimmed : `[${trimmed}]`)
      const extractText = (nodes: any[]): string => {
        const lines: string[] = []
        for (const node of nodes) {
          if (node.type === 'text') {
            lines.push(node.text || '')
          } else if (node.type === 'heading') {
            const level = node.attrs?.level || 1
            const prefix = '#'.repeat(level)
            lines.push(`${prefix} ${extractText(node.content || [])}`)
          } else if (node.type === 'paragraph') {
            lines.push(extractText(node.content || []))
          } else if (node.type === 'bulletList' || node.type === 'taskList') {
            for (const item of node.content || []) {
              const itemText = extractText(item.content || [])
              if (node.type === 'taskList') {
                const checked = item.attrs?.checked ? '[x]' : '[ ]'
                lines.push(`- ${checked} ${itemText}`)
              } else {
                lines.push(`- ${itemText}`)
              }
            }
          } else if (node.type === 'orderedList') {
            let idx = 1
            for (const item of node.content || []) {
              lines.push(`${idx++}. ${extractText(item.content || [])}`)
            }
          } else if (node.type === 'callout') {
            const icon = node.attrs?.icon || '💡'
            lines.push(`> ${icon} ${extractText(node.content || [])}`)
          } else if (node.type === 'blockquote') {
            lines.push(`> ${extractText(node.content || [])}`)
          } else if (node.type === 'codeBlock') {
            lines.push(`\`\`\`\n${extractText(node.content || [])}\n\`\`\``)
          } else if (node.content) {
            lines.push(extractText(node.content))
          }
        }
        return lines.join('\n\n')
      }
      return extractText(parsed)
    } catch {
      // Not valid JSON — return as-is
    }
  }
  return text
}

/** Extract plain text of the selected content. */
const getSelectedText = () => {
  if (!editor.value) return ''
  const { from, to } = editor.value.state.selection
  return editor.value.state.doc.textBetween(from, to, '\n')
}

// --- AI Suggestion Popup State ---

interface AiSuggestionState {
  visible: boolean
  loading: boolean
  result: string
  error: string
  operationLabel: string
  /** Saved selection range for accept/insert-below actions */
  selectionRange: { from: number; to: number }
  /** Operation name + params for "Try again" */
  operation: string
  operationParams: Record<string, any>
  /** When true, result is inserted inline in the editor — popup only shows action bar */
  inlineMode: boolean
}

const aiSuggestion = reactive<AiSuggestionState>({
  visible: false,
  loading: false,
  result: '',
  error: '',
  operationLabel: '',
  selectionRange: { from: 0, to: 0 },
  operation: '',
  operationParams: {},
  inlineMode: false,
})

const aiSuggestionStyle = ref<Record<string, string>>({ display: 'none' })

const aiSuggestionPopupRef = ref<InstanceType<typeof DocAiSuggestionPopup> | null>(null)

const editorContentRef = ref<HTMLElement | null>(null)

/** Scroll the AI suggestion popup into view within the scroll container. */
const scrollAiSuggestionIntoView = () => {
  nextTick(() => {
    const el = (aiSuggestionPopupRef.value as any)?.$el as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

const aiHighlightPluginKey = new PluginKey('aiHighlight')
/** Add a highlight decoration over the given range to mark AI-generated content.
 *  The highlight persists until dismissed, then clears on the next user interaction. */
const addAiHighlight = (from: number, to: number) => {
  if (!editor.value) return
  // Remove any existing highlight first
  removeAiHighlight()

  const plugin = new Plugin({
    key: aiHighlightPluginKey,
    state: {
      init(_, state) {
        const clampedTo = Math.min(to, state.doc.content.size)
        return DecorationSet.create(state.doc, [Decoration.inline(from, clampedTo, { class: 'nc-doc-ai-generated' })])
      },
      apply(tr, set) {
        // Keep decorations alive — removal is handled by markAiHighlightForRemoval
        // via DOM class swap + plugin unregister after fade animation.
        return set.map(tr.mapping, tr.doc)
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)
      },
    },
  })
  editor.value.registerPlugin(plugin)
  // Force ProseMirror to re-render with the new decorations
  editor.value.view.dispatch(editor.value.state.tr)
}

/** Mark the AI highlight for removal on the next user interaction.
 *  Deferred so synchronous transactions from dismiss/focus don't clear it immediately.
 *  On the triggering transaction, swaps the class to a fade-out animation before removal. */
const markAiHighlightForRemoval = () => {
  setTimeout(() => {
    // Listen for the next transaction to trigger the fade-out
    const handler = () => {
      if (!editor.value) return
      editor.value.off('transaction', handler)
      // Swap class on DOM spans to trigger CSS fade-out animation
      const editorEl = editor.value.view.dom
      const spans = editorEl.querySelectorAll('.nc-doc-ai-generated')
      spans.forEach((span) => {
        span.classList.remove('nc-doc-ai-generated')
        span.classList.add('nc-doc-ai-fadeout')
      })
      // Unregister plugin after animation completes
      setTimeout(() => {
        try {
          editor.value?.unregisterPlugin(aiHighlightPluginKey)
        } catch {}
      }, 600)
    }
    editor.value?.on('transaction', handler)
  }, 100)
}

/** Remove the AI highlight decoration. */
function removeAiHighlight() {
  if (!editor.value) return
  editor.value.unregisterPlugin(aiHighlightPluginKey)
}

/** Position the suggestion popup below the text selection using ProseMirror coordinates.
 *  Uses editor.view.coordsAtPos() which is stable regardless of mouse position. */
const positionAiSuggestion = () => {
  if (!editor.value || !editorContentRef.value) {
    aiSuggestionStyle.value = { display: 'none' }
    return
  }

  const { from, to } = editor.value.state.selection
  if (from === to) {
    aiSuggestionStyle.value = { display: 'none' }
    return
  }

  const view = editor.value.view
  const startCoords = view.coordsAtPos(from)
  const endCoords = view.coordsAtPos(to)
  const containerRect = editorContentRef.value.getBoundingClientRect()

  // Bottom of selection = the lowest line's bottom edge
  const selectionBottom = Math.max(startCoords.bottom, endCoords.bottom)
  // Left-align with the start of the selection
  const selectionLeft = startCoords.left

  // Clamp left so popup (max 560px wide) doesn't overflow the container
  const popupMaxWidth = 560
  const rawLeft = selectionLeft - containerRect.left
  const maxLeft = Math.max(0, containerRect.width - popupMaxWidth)
  const left = Math.max(0, Math.min(rawLeft, maxLeft))

  aiSuggestionStyle.value = {
    position: 'absolute',
    top: `${selectionBottom - containerRect.top + 12}px`,
    left: `${left}px`,
    zIndex: '50',
  }
}

/** Show the AI suggestion popup with a loading state, then run the AI operation. */
const showAiSuggestion = async (
  operation: string,
  operationParams: Record<string, any>,
  operationLabel: string,
  aiFn: () => Promise<string | undefined>,
) => {
  if (blockDocAi.value) {
    showUpgradeToUseDocAi({ triggerSource: 'doc-ai' })
    return
  }
  if (!editor.value) return

  // Save selection range before the async call
  const { from, to } = editor.value.state.selection
  if (from === to) return

  aiSuggestion.visible = true
  aiSuggestion.loading = true
  aiSuggestion.result = ''
  aiSuggestion.error = ''
  aiSuggestion.operationLabel = operationLabel
  aiSuggestion.selectionRange = { from, to }
  aiSuggestion.operation = operation
  aiSuggestion.operationParams = operationParams

  positionAiSuggestion()
  scrollAiSuggestionIntoView()

  try {
    const rawResult = await aiFn()
    aiSuggestion.loading = false
    if (rawResult) {
      aiSuggestion.result = sanitizeAiResponse(rawResult)
      scrollAiSuggestionIntoView()
    } else {
      aiSuggestion.error = 'No result returned'
    }
  } catch {
    aiSuggestion.loading = false
    aiSuggestion.error = 'Something went wrong. Please try again.'
  }
}

/** Insert AI result inline at the given position, highlight it, and switch to sticky action bar. */
const insertInlineAiResult = (sanitized: string, pos: number) => {
  if (!editor.value) return
  editor.value.chain().focus().setTextSelection(pos).run()
  const beforeSize = editor.value.state.doc.content.size
  insertMarkdownContent(editor.value, sanitized)
  const afterSize = editor.value.state.doc.content.size
  const insertedLength = afterSize - beforeSize
  addAiHighlight(pos, pos + insertedLength)
  aiSuggestionStyle.value = {
    position: 'sticky',
    bottom: '24px',
    zIndex: '50',
  }
  scrollAiSuggestionIntoView()
}

/** Show the AI suggestion popup at the cursor position (no selection needed).
 *  Inserts the result inline into the editor and shows an action bar below.
 *  Used for operations like "Continue writing" triggered from the slash menu. */
const showAiSuggestionAtCursor = async (
  operation: string,
  operationParams: Record<string, any>,
  operationLabel: string,
  aiFn: () => Promise<string | undefined>,
) => {
  if (blockDocAi.value) {
    showUpgradeToUseDocAi({ triggerSource: 'doc-ai' })
    return
  }
  if (!editor.value || !editorContentRef.value) return

  const pos = editor.value.state.selection.from

  aiSuggestion.visible = true
  aiSuggestion.loading = true
  aiSuggestion.result = ''
  aiSuggestion.error = ''
  aiSuggestion.operationLabel = operationLabel
  aiSuggestion.selectionRange = { from: pos, to: pos }
  aiSuggestion.operation = operation
  aiSuggestion.operationParams = operationParams
  aiSuggestion.inlineMode = true

  // Position loader at cursor
  const view = editor.value.view
  const coords = view.coordsAtPos(pos)
  const containerRect = editorContentRef.value.getBoundingClientRect()

  const popupMaxWidth = 560
  const rawLeft = coords.left - containerRect.left
  const maxLeft = Math.max(0, containerRect.width - popupMaxWidth)
  const left = Math.max(0, Math.min(rawLeft, maxLeft))

  aiSuggestionStyle.value = {
    position: 'absolute',
    top: `${coords.bottom - containerRect.top + 12}px`,
    left: `${left}px`,
    zIndex: '50',
  }
  scrollAiSuggestionIntoView()

  try {
    const rawResult = await aiFn()
    aiSuggestion.loading = false
    if (rawResult) {
      const sanitized = sanitizeAiResponse(rawResult)
      aiSuggestion.result = sanitized
      insertInlineAiResult(sanitized, pos)
    } else {
      aiSuggestion.error = 'No result returned'
    }
  } catch {
    aiSuggestion.loading = false
    aiSuggestion.error = 'Something went wrong. Please try again.'
  }
}

const dismissAiSuggestion = () => {
  // Abort any in-flight AI request
  abortCurrentRequest()
  // In inline mode with result already inserted, undo the insertion on discard
  if (aiSuggestion.inlineMode && aiSuggestion.result && editor.value) {
    removeAiHighlight()
    editor.value.commands.undo()
  }
  aiSuggestion.visible = false
  aiSuggestion.loading = false
  aiSuggestion.result = ''
  aiSuggestion.error = ''
  aiSuggestion.inlineMode = false
  // Refocus editor so the bubble menu can reappear on next selection
  editor.value?.commands.focus()
}

const onAiSuggestionDiscard = () => {
  $e('a:doc:ai:suggestion:discard', { operation: aiSuggestion.operation })
  dismissAiSuggestion()
}

const onAiSuggestionStop = () => {
  $e('a:doc:ai:suggestion:stop', { operation: aiSuggestion.operation })
  dismissAiSuggestion()
}

const onAiSuggestionAccept = () => {
  if (!editor.value || !aiSuggestion.result) return
  $e('a:doc:ai:suggestion:accept', { operation: aiSuggestion.operation })

  if (aiSuggestion.inlineMode) {
    // Inline mode — content already in editor.
    // Mark highlight for removal on next user interaction (click/type).
    markAiHighlightForRemoval()
    // Reset inlineMode before dismiss so it doesn't undo the insertion
    aiSuggestion.inlineMode = false
    dismissAiSuggestion()
    return
  }

  const { from, to } = aiSuggestion.selectionRange
  // Selection-mode — replace selected text
  editor.value.chain().focus().setTextSelection({ from, to }).deleteSelection().run()
  const beforeSize = editor.value.state.doc.content.size
  insertMarkdownContent(editor.value, aiSuggestion.result)
  const afterSize = editor.value.state.doc.content.size
  addAiHighlight(from, from + (afterSize - beforeSize))
  markAiHighlightForRemoval()
  dismissAiSuggestion()
}

const onAiSuggestionInsertBelow = () => {
  if (!editor.value || !aiSuggestion.result) return
  $e('a:doc:ai:suggestion:insertBelow', { operation: aiSuggestion.operation })

  const { to } = aiSuggestion.selectionRange
  editor.value.chain().focus().setTextSelection(to).run()
  const beforeSize = editor.value.state.doc.content.size
  insertMarkdownContent(editor.value, `\n${aiSuggestion.result}`)
  const afterSize = editor.value.state.doc.content.size
  addAiHighlight(to, to + (afterSize - beforeSize))
  markAiHighlightForRemoval()
  dismissAiSuggestion()
}

const onAiSuggestionTryAgain = () => {
  $e('a:doc:ai:suggestion:tryAgain', { operation: aiSuggestion.operation })
  if (aiSuggestion.operation === 'continue') {
    // Undo previous inline insertion, then re-run
    if (aiSuggestion.inlineMode && aiSuggestion.result && editor.value) {
      removeAiHighlight()
      editor.value.commands.undo()
    }
    // Re-read position from editor state after undo (stored pos may be invalid)
    const pos = editor.value?.state.selection.from ?? aiSuggestion.selectionRange.from
    aiSuggestion.selectionRange = { from: pos, to: pos }
    const fullText = editor.value!.state.doc.textBetween(0, pos, '\n')
    const precedingContent = fullText.length > 2000 ? fullText.slice(-2000) : fullText
    if (!precedingContent.trim() && !title.value?.trim()) return
    aiSuggestion.loading = true
    aiSuggestion.result = ''
    aiSuggestion.error = ''
    aiContinue(precedingContent, title.value)
      .then((rawResult) => {
        aiSuggestion.loading = false
        if (rawResult && editor.value) {
          const sanitized = sanitizeAiResponse(rawResult)
          aiSuggestion.result = sanitized
          insertInlineAiResult(sanitized, pos)
        } else {
          aiSuggestion.error = 'No result returned'
        }
      })
      .catch(() => {
        aiSuggestion.loading = false
        aiSuggestion.error = 'Something went wrong. Please try again.'
      })
  } else {
    runAiSuggestionOperation(aiSuggestion.operation, aiSuggestion.operationParams)
  }
}

/** Reset all AI submenu panels to hidden when the dropdown opens/closes. */
const resetAiSubMenus = () => {
  document.querySelectorAll('.nc-doc-ai-menu .nc-doc-ai-menu-sub-panel').forEach((el) => {
    ;(el as HTMLElement).style.display = 'none'
  })
}

/** Position a submenu panel based on available viewport space.
 *  Also hides any other open sub-panels to prevent overlap. */
const positionSubMenu = (e: MouseEvent) => {
  const currentSub = e.currentTarget as HTMLElement
  const subEl = currentSub?.querySelector('.nc-doc-ai-menu-sub-panel') as HTMLElement
  if (!subEl) return

  // Hide all other sub-panels first
  const menu = currentSub.closest('.nc-doc-ai-menu')
  menu?.querySelectorAll('.nc-doc-ai-menu-sub-panel').forEach((el) => {
    if (el !== subEl) (el as HTMLElement).style.display = 'none'
  })

  // Show this one to measure
  subEl.style.display = 'block'
  const parentRect = currentSub.getBoundingClientRect()
  const panelWidth = subEl.offsetWidth || 200
  const panelHeight = subEl.offsetHeight || 300

  // Horizontal: prefer right, flip to left if no space
  const spaceRight = window.innerWidth - parentRect.right
  if (spaceRight < panelWidth + 8) {
    subEl.style.left = 'auto'
    subEl.style.right = '100%'
  } else {
    subEl.style.left = '100%'
    subEl.style.right = 'auto'
  }

  // Vertical: align top with trigger item, clamp to viewport
  const absoluteTop = parentRect.top
  const overflow = absoluteTop + panelHeight - window.innerHeight + 8
  if (overflow > 0) {
    subEl.style.top = `${-overflow}px`
  } else if (absoluteTop < 8) {
    subEl.style.top = `${8 - parentRect.top}px`
  } else {
    subEl.style.top = '0px'
  }
}

/** Dispatch an AI operation into the suggestion popup. */
function runAiSuggestionOperation(operation: string, params: Record<string, any>) {
  const selected = getSelectedText()
  if (!selected.trim()) return

  // Immediately hide bubble menu before async work begins
  aiSuggestion.visible = true

  if (operation === 'improve') {
    const mode = params.mode as string
    const labelKey: Record<string, string> = {
      writing: 'labels.docAiImproveWriting',
      grammar: 'labels.docAiFixGrammar',
      shorter: 'labels.docAiMakeShorter',
      longer: 'labels.docAiMakeLonger',
    }
    // For tone modes, capitalize the mode name as the label
    const label = labelKey[mode] ? t(labelKey[mode]) : mode.charAt(0).toUpperCase() + mode.slice(1)
    showAiSuggestion('improve', params, label, () => aiImprove(selected, mode))
  } else if (operation === 'translate') {
    const lang = params.targetLanguage as string
    showAiSuggestion('translate', params, t('labels.docAiTranslateTo', { language: lang }), () => aiTranslate(selected, lang))
  } else if (operation === 'summarize') {
    showAiSuggestion('summarize', params, t('labels.docAiSummarize'), () => aiSummarize(selected))
  }
}

/**
 * Wire AI handlers into editor.storage.docAi so slash commands + bubble menu
 * can invoke them without needing direct access to the composable.
 */
const wireDocAiStorage = () => {
  if (!editor.value) return

  editor.value.storage.docAi = {
    write: async (instruction: string) => {
      if (blockDocAi.value) {
        showUpgradeToUseDocAi({ triggerSource: 'doc-ai' })
        return
      }
      $e('a:doc:ai:write')
      const context = getDocPlainText(2000, false)
      const result = await aiWrite(instruction, context, title.value)
      if (result && editor.value) {
        insertMarkdownContent(editor.value, result)
      }
    },
    continueWriting: async () => {
      if (blockDocAi.value) {
        showUpgradeToUseDocAi({ triggerSource: 'doc-ai' })
        return
      }
      $e('a:doc:ai:continue')
      // Send document content up to the cursor position, not the entire document
      const pos = editor.value!.state.selection.from
      const fullText = editor.value!.state.doc.textBetween(0, pos, '\n')
      const precedingContent = fullText.length > 2000 ? fullText.slice(-2000) : fullText
      if (!precedingContent.trim() && !title.value?.trim()) return
      showAiSuggestionAtCursor('continue', {}, t('labels.docAiContinueWriting'), () =>
        aiContinue(precedingContent || '', title.value),
      )
    },
    summarize: async () => {
      if (blockDocAi.value) {
        showUpgradeToUseDocAi({ triggerSource: 'doc-ai' })
        return
      }
      $e('a:doc:ai:summarize')
      const text = (editor.value?.state.doc.textContent || '').slice(0, 10000)
      if (!text.trim()) return
      showAiSuggestionAtCursor('summarize', {}, t('labels.docAiSummarize'), () => aiSummarize(text))
    },
    improve: (mode: string) => {
      if (blockDocAi.value) {
        showUpgradeToUseDocAi({ triggerSource: 'doc-ai' })
        return
      }
      $e('a:doc:ai:improve', { mode })
      runAiSuggestionOperation('improve', { mode })
    },
    translate: (targetLanguage: string) => {
      if (blockDocAi.value) {
        showUpgradeToUseDocAi({ triggerSource: 'doc-ai' })
        return
      }
      $e('a:doc:ai:translate', { targetLanguage })
      runAiSuggestionOperation('translate', { targetLanguage })
    },
    _pendingInstruction: null,
    get isLoading() {
      return docAiLoading.value
    },
  }
}

/** Summarize just the selected text (bubble menu action) — routes through popup. */
const onAiSummarizeSelection = () => {
  if (blockDocAi.value) {
    showUpgradeToUseDocAi({ triggerSource: 'doc-ai' })
    return
  }
  $e('a:doc:ai:summarize:selection')
  runAiSuggestionOperation('summarize', {})
}

// --- Search & Replace bar state (Cmd/Ctrl+F) ---
// The bar is rendered inside the editor's relative wrapper and uses
// DocSearchExtension (ProseMirror plugin) for match finding + decorations.
const isSearchOpen = ref(false)
const searchBarRef = ref<{ focusSearch: () => void } | null>(null)

// --- Cell selection color (bubble menu shows palette instead of text formatting) ---
const isCellSelection = computed(() => editor.value?.state.selection instanceof CellSelection)

const applyCellColor = (attr: 'bgColor' | 'cellTextColor', color: string | null) => {
  if (!editor.value) return
  const sel = editor.value.state.selection
  if (!(sel instanceof CellSelection)) return

  // Update cell DOM directly, then set content from DOM to sync ProseMirror state.
  // This avoids the CellSelection decoration crash that occurs when dispatching
  // setNodeMarkup while cell decorations are active.
  const view = editor.value.view

  const domAttr = attr === 'bgColor' ? 'data-bg-color' : 'data-cell-text-color'
  const cssProp = attr === 'bgColor' ? 'background-color' : 'color'
  const varPrefix = attr === 'bgColor' ? '--nc-doc-bg-' : '--nc-doc-text-'

  sel.forEachCell((_node, pos) => {
    const dom = view.nodeDOM(pos) as HTMLElement | null
    if (!dom) return

    if (color) {
      dom.setAttribute(domAttr, color)
      dom.style.setProperty(cssProp, `var(${varPrefix}${color})`)
    } else {
      dom.removeAttribute(domAttr)
      dom.style.removeProperty(cssProp)
    }
  })

  // Sync DOM back to ProseMirror state so changes persist on save
  // Use a short delay to let the view settle, then dispatch from clean state
  nextTick(() => {
    if (!editor.value) return
    const { state: s, dispatch } = editor.value.view
    const tr = s.tr

    sel.forEachCell((_node, pos) => {
      if (pos < s.doc.content.size) {
        const node = s.doc.nodeAt(pos)
        if (node) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, [attr]: color || null })
        }
      }
    })

    // Collapse selection before dispatch to avoid decoration crash
    tr.setSelection(TextSelection.create(tr.doc, sel.$anchorCell.start()))
    dispatch(tr)
  })
}

// --- Comments sidebar state ---
const isCommentsPanelOpen = ref(false)
const pendingInlineCommentSelection = ref<{ from: number; to: number } | null>(null)

const toggleCommentsPanel = () => {
  isCommentsPanelOpen.value = !isCommentsPanelOpen.value
}

// --- History modal state ---
// Single modal containing both the version list (right pane) and the
// diff viewer (left pane). No sidebar — opening the menu item just
// flips this flag.
const isHistoryModalOpen = ref(false)

const onOpenHistory = () => {
  isHistoryModalOpen.value = true
  isPageMenuOpen.value = false
}

const { showUpgradeToUseDocsInlineComments, showUpgradeToUseDocsExportPdf } = useEeConfig()

const onAddInlineComment = () => {
  if (showUpgradeToUseDocsInlineComments({ triggerSource: 'doc-inline-comments' })) {
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
  // Prefer the store doc — its `comment_count` is kept live by the realtime comment
  // handler (useRealtime), so the count updates even with the panel closed. Fall back
  // to the loaded doc for the brief window before the store row resolves.
  return activeDocument.value?.comment_count ?? doc.value?.comment_count ?? 0
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
  // When collab is active the editor stays non-editable until the Y.Doc has
  // synced (so the user can't type into an unsynced doc and lose/duplicate
  // content); editability still ultimately tracks `isEditable` (read-only
  // viewers join collab to see live edits but can't write).
  editable: isEditable.value && (!collabEnabled || collabSynced.value),
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false, // replaced by DocCodeBlockExtension (lowlight + language selector)
      // Collaboration brings its own Yjs-backed undo manager — the StarterKit
      // history plugin must be disabled to avoid conflicting with it.
      ...(collabEnabled ? { history: false } : {}),
    }),
    ...(collabEnabled && collab
      ? [
          Collaboration.configure({ document: collab.ydoc, field: 'default' }),
          CollaborationCursor.configure({
            provider: { awareness: collab.awareness } as any,
            user: { name: collabUser!.name, color: collabUser!.color },
          }),
        ]
      : []),
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
    DocWebBookmarkExtension,
    DocActiveBlockExtension,
    DocBlockDirExtension,
    DocHeadingCollapseExtension,
    // Anchors are decoration-only (no doc mutation) — safe to render in
    // read-only embedded mode. Excluded only for embedded consumers that don't
    // opt into the rail (SmartText cells), keeping their PM output untouched.
    ...(props.embedded && !props.headingRail ? [] : [DocHeadingAnchorExtension]),
    DocDragHandleExtension,
    DocSearchExtension,
    DocAiExtension,
  ],
  editorProps: {
    attributes: {
      class: 'nc-doc-editor-content focus:outline-none min-h-[60px]',
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

      // Escape inside a table or columns block: move cursor to first paragraph after the block.
      // If no paragraph exists after the block, insert one. The innermost matching ancestor wins,
      // so a table nested inside a column escapes the table first.
      if (event.key === 'Escape') {
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d)
          if (node.type.name === 'table' || node.type.name === 'columns') {
            const blockEndPos = $from.after(d)
            const $afterBlock = state.doc.resolve(blockEndPos)

            // Check if a block exists right after this block
            if ($afterBlock.nodeAfter) {
              // Move cursor to start of the next block
              view.dispatch(state.tr.setSelection(state.selection.constructor.near(state.doc.resolve(blockEndPos + 1))))
            } else {
              // No block after — insert an empty paragraph and focus it
              const paragraph = state.schema.nodes.paragraph.create()
              const tr = state.tr.insert(blockEndPos, paragraph)
              tr.setSelection(state.selection.constructor.near(tr.doc.resolve(blockEndPos + 1)))
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

      // Progressive select-all:
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

        // Empty first paragraph inside a list item that also contains additional
        // content (e.g. a nested list): lift the item out. ProseMirror's default
        // joinBackward only handles the simple empty-item case — when the item has
        // extra block content, it strands the caret.
        if ($from.parent.content.size === 0) {
          for (let d = $from.depth - 1; d >= 1; d--) {
            const item = $from.node(d)
            const typeName = item.type.name
            if (typeName === 'listItem' || typeName === 'taskItem') {
              const isFirstParagraphInItem = d === $from.depth - 1 && $from.index(d) === 0
              // Skip when default already works: item has only the empty paragraph
              if (!isFirstParagraphInItem || item.childCount <= 1) break
              if (editor.value?.commands.liftListItem(typeName)) return true
              break
            }
            if (typeName === 'bulletList' || typeName === 'orderedList' || typeName === 'taskList') break
          }
        }

        // First empty block in document: delete it when there are siblings below.
        // ProseMirror's default joinBackward can't remove the very first block.
        // Only apply when the paragraph is a direct child of the doc (depth === 1),
        // not when nested inside a list or other wrapper — otherwise the entire
        // wrapper (e.g. bulletList) gets deleted instead of just the empty item.
        if ($from.depth === 1 && $from.index(0) === 0 && $from.parent.content.size === 0 && state.doc.childCount > 1) {
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
  onUpdate: ({ editor: e }) => {
    // Dismiss paste-link menu on any editor content change (typing, etc.)
    if (pasteLinkMenu.value.visible) dismissPasteLinkMenu()
    if (isCellMode.value) {
      // Cell mode: parent owns persistence; emit JSON on every edit.
      // No debounce here — SmartTextPanel batches via session-end triggers.
      emit('update:content', e.getJSON() as Record<string, any>)
    } else if (!collabEnabled) {
      // Collab mode: the server owns body persistence via Yjs, so skip the REST
      // debounced save. Title saves are persisted separately (onTitleBlur /
      // debouncedTitleSync).
      debouncedSave()
    }
    countTasks()
  },
  onSelectionUpdate: () => {
    onSelectionUpdate()
  },
})

// Sync the Tiptap-managed editor ref into our manually created ref
// so composables (declared above) can access the editor instance reactively.
//
// Single-live-editor invariant: under Nuxt's <Suspense>/async-page mount path
// `useEditor`'s creation can run more than once on the same component instance,
// producing a second Editor while the first is never torn down. The orphan keeps
// a live ProseMirror view in the DOM (duplicate body) and — in collab mode — a
// second CollaborationCursor bound to the shared awareness, which floods peers
// and corrupts their editable state. `useEditor` only destroys on unmount, so it
// can't guard against in-place recreation. Destroy the prior instance whenever it
// is replaced so exactly one editor is ever live.
watch(
  _tiptapEditor,
  (e, prev) => {
    if (prev && prev !== e) prev.destroy()
    editor.value = e
    // Apply the current editable state to the freshly-adopted instance. The
    // editor is created asynchronously, so the `editable` option captured when
    // `useEditor()` ran may be stale by now — in collab mode `collabSynced` can
    // flip true (sync converged) before the instance exists, and the editable
    // watch above skips while `editor.value` is null. Without re-applying here,
    // the editor is born read-only and nothing ever flips it (no further
    // `collabSynced`/`isEditable` change to trigger the watch).
    if (e) e.setEditable(isEditable.value && (!collabEnabled || collabSynced.value))
    wireDocAiStorage()
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
      // Save cursor position before the file dialog steals focus
      const savedPos = ed.state.selection.from

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

      // Restore cursor and focus after file dialog — the native dialog can
      // leave ProseMirror's DOM selection in an inconsistent state
      ed.chain().focus().setTextSelection(savedPos).insertContent(nodes).run()

      for (const { file, blobUrl } of blobEntries) {
        uploadAndInsert(ed, file, blobUrl)
      }
      $e('a:doc:image:upload', { source: 'slash-command', count: files.length })
    }
  }
  if (ed?.storage?.fileAttachment) {
    ed.storage.fileAttachment.openUpload = async () => {
      // Save cursor position before the file dialog steals focus
      const savedPos = ed.state.selection.from

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

      // Restore cursor and focus after file dialog
      ed.chain().focus().setTextSelection(savedPos).insertContent(nodes).run()

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
  if (ed?.storage?.webBookmark) {
    ed.storage.webBookmark.insertFromUrl = async (editor: any, rawUrl: string) => {
      const url = rawUrl.trim()
      if (!/^https?:\/\//i.test(url)) {
        ncMessage.warning(t('msg.invalidBookmarkUrl'))
        return
      }

      // Insert placeholder card immediately so user gets feedback
      editor.chain().focus().insertWebBookmark({ url, isLoading: true }).run()

      const settleNode = (patch: Record<string, any>) => {
        editor
          .chain()
          .command(({ tr, state }: { tr: any; state: any }) => {
            let updated = false
            state.doc.descendants((node: any, pos: number) => {
              if (updated) return false
              if (node.type.name === 'webBookmark' && node.attrs.url === url && node.attrs.isLoading) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch, url, isLoading: false })
                updated = true
                return false
              }
              return true
            })
            return updated
          })
          .run()
      }

      const base = basesStore.bases.get(activeProjectId.value!)
      if (!base?.fk_workspace_id || !base?.id) {
        // Without base context the backend can't ACL-check; fall back to URL-only card
        settleNode({ status: 'fetch_failed' })
        return
      }

      try {
        const metadata = (await $api.internal.postOperation(
          base.fk_workspace_id,
          base.id,
          { operation: 'webBookmarkFetch' },
          { url },
        )) as WebBookmarkMetadata

        settleNode(metadata)
        $e('a:doc:web-bookmark:create', {
          hasImage: !!metadata?.imageUrl,
          status: metadata?.status ?? 'fetched',
        })
      } catch (e: any) {
        settleNode({ status: 'fetch_failed' })
        ncMessage.error(await extractSdkResponseErrorMsg(e))
      }
    }
  }
})

// Keep editor editable state in sync with the user's role.
// Roles may resolve asynchronously (e.g. after workspace/base data loads).
// When collab is active, also gate on `collabSynced` so the editor stays
// read-only until the Y.Doc has converged with the server (prevents typing
// into an unsynced doc). `collabSynced` is a static `ref(false)` when collab
// is off, so the expression collapses to plain `isEditable` in that case.
watch([isEditable, collabSynced], ([val, synced]) => {
  if (editor.value) {
    editor.value.setEditable(val && (!collabEnabled || synced))
  }
})

// Mirror remote document meta (icon / cover / font) into the local doc in collab
// mode. The body and title live in the Y.Doc, but meta stays on the REST path:
// a peer's icon change arrives via DOCUMENT_EVENT → the store's activeDocument,
// and the version-reload watch that used to sync store → local doc is disabled
// for collab. Without this, a peer's icon/cover wouldn't reflect in the editor
// chrome (which renders from `doc.value.meta` via `docMeta`).
if (collabEnabled) {
  watch(
    () => activeDocument.value?.meta,
    (storeMeta) => {
      if (storeMeta === undefined || !doc.value || !isLoaded.value) return
      if (activeDocument.value?.id !== doc.value.id) return
      doc.value.meta = storeMeta
    },
  )
}

// Bootstrap legacy docs into the CRDT. The first client to open a doc whose
// server-side Y.Doc is still empty seeds it from the doc's stored PM JSON, so
// existing (pre-collab) documents migrate into Yjs. After the first persist the
// server's Yjs state is non-empty, so subsequent clients see content via the
// sync handshake and skip seeding — `hasBootstrapped` additionally guards
// against re-seeding within this session. Gated on `isLoaded` too so the stored
// `content` is available before we decide whether to seed (synced and the doc
// load resolve independently).
if (collabEnabled && collab) {
  // `editor` is a watch source too: if sync + load + grant all resolve before
  // the (async) editor instance exists, the seed must re-run once it does —
  // otherwise the doc would be marked bootstrapped without ever migrating its
  // legacy content (and a later persist could overwrite the stored content with
  // the empty Y.Doc).
  watch([collabSynced, isLoaded, collab.mayBootstrap, editor], ([synced, loaded]) => {
    if (!synced || !loaded || hasBootstrapped) return

    // Title: enable the live binding (adopt the shared Y.Text title) and, if this
    // client is the granted seeder, seed it from the loaded title. Independent of
    // body content, so it runs even when the body needs no migration.
    // `loaded` gates on isLoaded, which flips true only after loadAndSetDoc has set
    // title.value — so the seed reads the real title (untitled → '' → no-op).
    collabTitle?.activate()
    if (collab.mayBootstrap.value) collabTitle?.seedIfEmpty(title.value)

    const fragment = collab.ydoc.getXmlFragment('default')
    if (fragment.length > 0) {
      // Server already has content — nothing to migrate.
      hasBootstrapped = true
      return
    }

    // Only the server-designated seeder migrates legacy content into the CRDT.
    // Two clients seeding concurrently would merge into duplicated body content,
    // so a non-granted client waits for the content to arrive over live sync.
    // Not marked bootstrapped: if the grant arrives after this fires, the watch
    // re-runs on `mayBootstrap` and re-checks.
    if (!collab.mayBootstrap.value) return

    // Editor not materialized yet — wait. Do NOT mark bootstrapped here, or the
    // legacy doc would never be seeded. The watch re-runs when `editor` resolves.
    const schema = editor.value?.schema
    if (!schema) return

    const legacyContent = parseDocContent(doc.value?.content)
    const isEmptyLegacy =
      !legacyContent?.content?.length ||
      (legacyContent.content.length === 1 && legacyContent.content[0]?.type === 'paragraph' && !legacyContent.content[0]?.content)

    if (isEmptyLegacy) {
      // Nothing meaningful to seed; mark bootstrapped so we don't re-check.
      hasBootstrapped = true
      return
    }

    // Seed via a normal Yjs update (origin is NOT 'remote') so it propagates to
    // the server and other clients.
    const seededDoc = prosemirrorJSONToYDoc(schema, legacyContent, 'default')
    Y.applyUpdate(collab.ydoc, Y.encodeStateAsUpdate(seededDoc))
    hasBootstrapped = true
  })
}

// Reactive flag: does the shared Y.Doc body have content (drives the F1
// fallback). Fragment length isn't reactive, so track it via 'update'.
const collabBodyHasContent = ref(false)
if (collabEnabled && collab) {
  const frag = collab.ydoc.getXmlFragment('default')
  const refreshBodyHasContent = () => {
    if (frag.length > 0) {
      collabBodyHasContent.value = true
      // One-way latch: once the CRDT has content we never revert to the
      // fallback, so stop observing.
      collab.ydoc.off('update', refreshBodyHasContent)
    }
  }
  collab.ydoc.on('update', refreshBodyHasContent)
  onBeforeUnmount(() => collab.ydoc.off('update', refreshBodyHasContent))
  refreshBodyHasContent()
}

const legacyFallbackContent = computed(() => parseDocContent(doc.value?.content))

// F1: a non-seeder viewing a legacy doc (empty server Y.Doc) would see a blank
// body. Show stored content read-only until an editor seeds the CRDT.
const showLegacyFallback = computed(() => {
  if (!collabEnabled || !collab) return false
  if (!collabSynced.value) return false // wait for sync before deciding
  if (collabBodyHasContent.value) return false // CRDT already has content
  if (collab.mayBootstrap.value) return false // we're the seeder — bootstrap fills it
  const parsed = legacyFallbackContent.value
  const isEmpty =
    !parsed?.content?.length ||
    (parsed.content.length === 1 && parsed.content[0]?.type === 'paragraph' && !parsed.content[0]?.content)
  return !isEmpty // legacy content exists to show
})

const activeFont = ref<'default' | 'serif' | 'mono'>('default')

type DocDir = 'ltr' | 'rtl' | 'auto'

const { isRtl: isAppRtl } = useRtl()

// Tri-state direction selector state. `null` = use default (app locale).
const activeDir = ref<DocDir | null>(null)

// Concrete direction applied to the editor wrapper only. Layout chrome
// (hanging title icon, padding) is anchored by this; per-block text
// direction inside the body is handled by DocBlockDirExtension, and the
// title input uses `dir="auto"` directly. The doc-level menu setting now
// only controls wrapper chrome — explicit ltr/rtl picks override the
// locale fallback for the icon side and empty-block neutral defaults.
const resolvedDir = computed<'ltr' | 'rtl'>(() => {
  if (activeDir.value === 'ltr') return 'ltr'
  if (activeDir.value === 'rtl') return 'rtl'
  return isAppRtl.value ? 'rtl' : 'ltr'
})

// Re-load doc when navigating between pages.
// Watch both docId AND activeProjectId — on a full page reload, activeProjectId
// may not be available yet when docId resolves from route params. Without this,
// loadDoc silently returns null (guard: !activeProjectId) and the editor stays empty.
// Skipped in cell mode — content comes from `initialContent` (see watcher below).
if (!isCellMode.value) {
  watch(
    [docId, activeProjectId],
    async ([newId, newBaseId]) => {
      if (newId && newBaseId) {
        await loadAndSetDoc(newId)

        const loadedFont = docMeta.value.font
        activeFont.value = loadedFont === 'serif' || loadedFont === 'mono' ? loadedFont : 'default'

        const loadedDir = docMeta.value.dir
        activeDir.value = loadedDir === 'ltr' || loadedDir === 'rtl' || loadedDir === 'auto' ? loadedDir : null

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
}

// Cell mode: push fresh PM content into the editor whenever the parent
// supplies a new value (initial open, switch field, navigate row).
// Watch `editor` too — useEditor populates the ref in onMounted, so an
// immediate-mode watcher on `props.initialContent` alone fires before the
// editor instance exists and silently no-ops. By also tracking `editor`,
// the watcher re-fires once Tiptap has the editor ready and applies the
// loaded PM JSON. Skip the setContent when already in sync to avoid loops.
if (isCellMode.value) {
  watch(
    [() => props.initialContent, editor],
    ([val, ed]) => {
      if (!ed) return
      // Normalize to a valid PM doc — `val` may be a stringified JSON column
      // (SQLite) or null on the public reader, which would otherwise render as
      // literal text or choke setContent.
      const next = parseDocContent(val)
      const current = ed.getJSON()
      if (JSON.stringify(current) === JSON.stringify(next)) return
      ed.commands.setContent(next as any, false)
    },
    { immediate: true, flush: 'post' },
  )
}

// Sync external title changes (e.g. sidebar rename) into the editor's local title ref.
// Skip when the editor itself initiated the change (isSaving) or when loading a new doc.
// Guard: only sync when activeDocument still matches the editor's local doc — during
// navigation activeDocument switches to the new page before loadAndSetDoc flushes
// the pending save, which would corrupt title.value with the wrong page's title.
//
// Collab mode owns the title through the shared Y.Text (useCollabTitle): local edits
// push to the Y.Text and a peer's edits arrive via its observer. The store
// (`activeDocument.title`) is a *downstream* consumer there — fed by `patchStoreTitle`
// and by `DOCUMENT_EVENT`s for the sidebar. Letting the store drive `title.value` back
// into the editor would close a feedback loop: a debounced collab persist broadcasts a
// `DOCUMENT_EVENT`, and if that lands just after a local rename, this watch would push
// the stale title back into the Y.Text — corrupting the open doc's title. So this REST
// reflection is disabled while collab is active.
if (!collabEnabled) {
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
}

const onTitleBlur = () => {
  // Collab mode persists the title via the shared Y.Doc, and the store stays in
  // sync live through `patchStoreTitle` — nothing to flush on blur.
  if (!isEditable.value || !doc.value || collabEnabled) return

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
  // In collab mode the title lives in the shared Y.Doc: `useCollabTitle` pushes
  // edits to the Y.Text and `patchStoreTitle` keeps the sidebar/URL in sync, while
  // the server persists from the Y.Doc. The REST-save path must stay out of it.
  if (isLoaded.value && !collabEnabled) {
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

  if (showUpgradeToUseDocumentPermissions({ triggerSource: 'doc-permissions' })) return

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

// --- Cover reposition (vertical focal point) ---
// Lets the user pick which vertical slice of the cover image shows in the
// fixed-height banner. Stored as `meta.cover_image_position` (0–100 %, default
// 50 = center) and applied via the image's object-position Y.
const coverImageEl = ref<HTMLImageElement | null>(null)

const isRepositioningCover = ref(false)

const isDraggingCover = ref(false)

const repositionY = ref(50)

let coverDragStartY = 0
let coverDragStartPos = 50
let coverOverflow = 0

const coverPosition = computed<number>(() => {
  const p = docMeta.value.cover_image_position
  return typeof p === 'number' ? p : 50
})

const coverObjectPosition = computed(() => `center ${isRepositioningCover.value ? repositionY.value : coverPosition.value}%`)

const startRepositionCover = () => {
  repositionY.value = coverPosition.value
  isRepositioningCover.value = true
}

const cancelRepositionCover = () => {
  isRepositioningCover.value = false
  isDraggingCover.value = false
}

function onCoverDragMove(e: MouseEvent) {
  if (!isDraggingCover.value || coverOverflow <= 0) return
  const dPercent = ((e.clientY - coverDragStartY) / coverOverflow) * 100
  // Drag down → reveal the top of the image (object-position Y decreases).
  repositionY.value = Math.min(100, Math.max(0, coverDragStartPos - dPercent))
}

function onCoverDragEnd() {
  isDraggingCover.value = false
  document.removeEventListener('mousemove', onCoverDragMove)
  document.removeEventListener('mouseup', onCoverDragEnd)
}

const onCoverDragStart = (e: MouseEvent) => {
  if (!isRepositioningCover.value || !coverImageEl.value) return
  e.preventDefault()

  const el = coverImageEl.value
  // Vertical overflow of the cover-scaled (object-fit: cover, width-driven) image.
  coverOverflow = el.naturalWidth > 0 ? el.naturalHeight * (el.clientWidth / el.naturalWidth) - el.clientHeight : 0

  isDraggingCover.value = true
  coverDragStartY = e.clientY
  coverDragStartPos = repositionY.value

  document.addEventListener('mousemove', onCoverDragMove)
  document.addEventListener('mouseup', onCoverDragEnd)
}

const saveRepositionCover = async () => {
  const newPos = Math.round(repositionY.value)
  isRepositioningCover.value = false

  if (!doc.value?.id || !base.value?.id || newPos === coverPosition.value) return

  try {
    doc.value.meta = { ...docMeta.value, cover_image_position: newPos }

    const updated = await updateDocument(base.value.id, doc.value.id, {
      meta: doc.value.meta,
      version: doc.value.version,
    })

    if (updated && doc.value) {
      doc.value.version = updated.version
      if (updated.meta) doc.value.meta = parseProp(updated.meta)
    }

    $e('a:doc:cover:reposition')
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

// Disabled together with the Text direction menu — see the comment in the
// template. Restoring the menu also brings this back into use.
// const setDocDir = async (dir: DocDir) => {
//   if (!doc.value?.id || !base.value?.id || dir === activeDir.value) return
//   activeDir.value = dir
//   try {
//     doc.value.meta = { ...docMeta.value, dir }
//     const updated = await updateDocument(base.value.id, doc.value.id, {
//       meta: doc.value.meta,
//       version: doc.value.version,
//     })
//     if (updated?.version && doc.value) doc.value.version = updated.version
//     $e('a:doc:dir:change', { dir })
//   } catch (e: any) {
//     ncMessage.error(await extractSdkResponseErrorMsg(e))
//   }
// }

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

const onDownloadHTML = async () => {
  isPageMenuOpen.value = false
  await downloadHTML()
}

const onDownloadPDF = async () => {
  isPageMenuOpen.value = false

  if (showUpgradeToUseDocsExportPdf({ triggerSource: 'doc-export-pdf' })) {
    return
  }

  await downloadPDF()
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
  }, 3000)
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

// Expose the Tiptap editor instance so parents (e.g. SmartTextPanel) can run
// the same export pipeline (markdown / html / pdf) used in the docs surface.
// Also surface the heading model + scroll-to-heading so the public share reader
// can mount the marker rail against its own external scroller.
defineExpose({ editor, headings: docHeadings, activeHeadingId, scrollToHeading })
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
  <div
    v-else
    class="nc-doc-editor flex flex-row h-full w-full overflow-hidden"
    :class="{ 'nc-doc-embedded': embedded, 'nc-doc-editor-cell': isCellMode }"
  >
    <!-- Editor area — relative wrapper for floating menu + scroll content -->
    <div class="relative flex-1 min-w-0 h-full overflow-hidden">
      <!-- Sticky header background — slides in when title scrolls out of view -->
      <Transition v-if="!embedded" name="nc-doc-sticky-slide">
        <div v-if="!isTitleVisible && isLoaded" class="nc-doc-sticky-header" />
      </Transition>

      <!-- Breadcrumb — always visible, same pattern as page menu -->
      <div v-if="!embedded" class="nc-doc-page-menu-left">
        <GeneralOpenLeftSidebarBtn />

        <DocBreadcrumb v-if="isLoaded" :doc-id="docId" :current-title="title" />
      </div>

      <!-- Heading marker rail — gutter minimap TOC. Works in edit + read-only
         (same component); auto-hidden when embedded/cell mode (no anchors). -->
      <DocHeadingRail
        v-if="!embedded && !isCellMode && isLoaded"
        :headings="docHeadings"
        :active-id="activeHeadingId"
        @jump="scrollToHeading"
      />

      <!-- Page actions — always visible at top-right -->
      <div v-if="!embedded" class="nc-doc-page-menu">
        <template v-if="!isMobileMode">
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
          <!-- Share — icon-only mirror of the menu's Share item. Hoisted out
             so the action is one click away (and discoverable) instead of
             living behind the 3-dot menu. Same gate + telemetry + handler
             as the menu entry, so the two stay aligned. -->
          <NcTooltip v-if="isUIAllowed('documentCreate')" :title="$t('activity.share')" placement="bottom" class="flex">
            <NcButton
              v-e="['c:doc:share:open']"
              size="small"
              type="text"
              data-testid="nc-doc-page-share-btn"
              @click="(event) => { openShareModal(); (event.currentTarget as HTMLElement)?.blur() }"
            >
              <!-- Blur the button after opening the modal: Ant restores focus
                 to the trigger when the modal closes, which leaves a blue
                 focus-visible ring lingering on the icon. Pre-emptively
                 dropping focus means there's nothing to restore to. -->
              <GeneralIcon icon="ncShare" />
            </NcButton>
          </NcTooltip>
        </template>
        <NcDropdown v-model:visible="isPageMenuOpen" placement="bottomRight" class="flex">
          <NcButton
            size="small"
            type="secondary"
            data-testid="nc-doc-page-menu-btn"
            @click.stop="isPageMenuOpen = !isPageMenuOpen"
          >
            <GeneralIcon icon="threeDotVertical" />
          </NcButton>
          <template #overlay>
            <NcMenu variant="small" class="!min-w-52">
              <NcMenuItem v-e="['c:doc:copy-link']" @click="onCopyPageLink">
                <GeneralIcon class="text-nc-content-gray-subtle" :icon="isLinkCopied ? 'check' : 'link'" />
                {{ isLinkCopied ? $t('general.copied') : $t('activity.copyLink') }}
              </NcMenuItem>
              <NcMenuItem
                v-if="isUIAllowed('documentCreate')"
                v-e="['c:doc:share:open']"
                inner-class="w-full"
                data-testid="nc-doc-page-share"
                @click="openShareModal"
              >
                <GeneralIcon class="text-nc-content-gray-subtle" icon="ncShare" />
                <span class="flex-1">
                  {{ $t('activity.share') }}
                </span>
                <PaymentUpgradeBadge :feature-enabled-callback="() => !blockDocShare" class="-mr-1" remove-click />
              </NcMenuItem>
              <NcDivider />
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
              <!--
                Text direction menu — disabled for now. Per-block detection via
                DocBlockDirExtension covers the common case; bring this back if
                we need an explicit override for whole-doc chrome direction.
              <NcDivider />
              <div class="nc-doc-dir-selector-label">{{ $t('labels.textDirection') }}</div>
              <div :key="activeDir ?? 'default'" class="nc-doc-dir-selector" data-testid="nc-doc-dir-selector" @click.stop>
                <button
                  v-for="d in (['ltr', 'auto', 'rtl'] as const)"
                  :key="d"
                  v-e="['c:doc:dir:change', { dir: d }]"
                  class="nc-doc-dir-option"
                  :class="{ 'nc-doc-dir-option-active': activeDir === d }"
                  :data-testid="`nc-doc-dir-option-${d}`"
                  @click="setDocDir(d)"
                >
                  <GeneralIcon
                    class="nc-doc-dir-icon"
                    :icon="d === 'ltr' ? 'ncAlignLeft' : d === 'rtl' ? 'ncAlignRight' : 'ncAlignCenter'"
                  />
                  <span class="nc-doc-dir-label">{{
                    d === 'ltr' ? $t('labels.directionLtr') : d === 'rtl' ? $t('labels.directionRtl') : $t('labels.directionAuto')
                  }}</span>
                </button>
              </div>
              -->
              <NcDivider />
              <NcMenuItem v-if="isUIAllowed('documentCreate')" @click="onDuplicatePage">
                <GeneralIcon class="text-nc-content-gray-subtle" icon="duplicate" />
                {{ $t('general.duplicate') }}
              </NcMenuItem>
              <NcMenuItem v-e="['c:doc:comments:toggle']" @click="onToggleCommentsPanel">
                <GeneralIcon class="text-nc-content-gray-subtle" icon="ncMessageCircle" />
                {{ $t('general.comments') }}
              </NcMenuItem>
              <NcMenuItem
                v-if="isUIAllowed('documentRevisionList') && !isMobileMode"
                v-e="['c:doc:history:open']"
                data-testid="nc-doc-page-history"
                @click="onOpenHistory"
              >
                <GeneralIcon class="text-nc-content-gray-subtle" icon="ncHistory" />
                {{ $t('labels.history') }}
              </NcMenuItem>
              <NcMenuItem v-if="!isMobileMode" v-e="['c:doc:full-width:toggle']" @click="toggleFullWidth">
                <GeneralIcon class="text-nc-content-gray-subtle" icon="ncMoveHorizontal" />
                {{ isFullWidth ? $t('labels.exitFullWidth') : $t('labels.fullWidth') }}
              </NcMenuItem>
              <NcMenuItem
                v-if="isUIAllowed('documentCreate')"
                v-e="['c:doc:permissions']"
                data-testid="nc-doc-page-permissions"
                inner-class="w-full"
                @click="onPagePermissions"
              >
                <GeneralIcon class="text-nc-content-gray-subtle" icon="ncLock" />
                <span class="flex-1">
                  {{ $t('title.pagePermissions') }}
                </span>
                <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS" remove-click />
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
              <template v-if="isUIAllowed('documentDelete')">
                <NcDivider />
                <NcMenuItem danger @click="onDeletePage">
                  <GeneralIcon icon="delete" />
                  {{ $t('general.delete') }}
                </NcMenuItem>
              </template>
              <NcDivider />
              <div class="nc-doc-menu-info">
                <span>{{ $t('labels.wordCount', { count: wordCount }) }}</span>
                <span v-if="updatedByLabel">{{ $t('labels.lastEditedBy', { user: updatedByLabel }) }}</span>
                <span v-if="updatedAgo">{{ updatedAgo }}</span>
              </div>
              <NcMenuItemCopyId
                v-if="doc"
                :id="doc.id"
                v-e="['c:document:copy-id']"
                :tooltip="$t('labels.copyDocumentId')"
                :label="`DOCUMENT ID: ${doc.id}`"
                data-testid="nc-doc-page-copy-id"
              />
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
          class="nc-doc-stale-banner w-full mx-auto px-6 sm:px-10 lg:px-16"
          :class="[embedded ? 'pt-2' : 'pt-[var(--topbar-height)]', { 'max-w-[900px]': !isFullWidth }]"
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

        <!-- Cover image banner — doc mode only; cells have no cover. -->
        <div
          v-if="!isCellMode && coverImageSrc"
          class="nc-doc-cover group relative w-full"
          :class="{ 'nc-doc-cover-repositioning': isRepositioningCover }"
          data-testid="nc-doc-cover"
        >
          <img
            ref="coverImageEl"
            :src="coverImageSrc"
            class="nc-doc-cover-image"
            :class="{ 'cursor-grab': isRepositioningCover && !isDraggingCover, 'cursor-grabbing': isDraggingCover }"
            :style="{ objectPosition: coverObjectPosition }"
            draggable="false"
            @mousedown="onCoverDragStart"
          />

          <div v-if="isRepositioningCover" class="nc-doc-cover-hint" data-testid="nc-doc-cover-hint">
            {{ $t('msg.info.dragToReposition') }}
          </div>

          <div v-if="isEditable" class="nc-doc-cover-controls">
            <template v-if="isRepositioningCover">
              <NcButton
                size="xsmall"
                type="secondary"
                data-testid="nc-doc-cover-reposition-cancel"
                @click="cancelRepositionCover"
              >
                {{ $t('general.cancel') }}
              </NcButton>
              <NcButton size="xsmall" type="primary" data-testid="nc-doc-cover-reposition-save" @click="saveRepositionCover">
                {{ $t('labels.savePosition') }}
              </NcButton>
            </template>
            <template v-else>
              <NcButton size="xsmall" type="secondary" data-testid="nc-doc-cover-reposition" @click="startRepositionCover">
                {{ $t('labels.reposition') }}
              </NcButton>
              <NcButton size="xsmall" type="secondary" data-testid="nc-doc-cover-change" @click="onAddOrChangeCover">
                {{ $t('labels.changeCover') }}
              </NcButton>
              <NcButton size="xsmall" type="secondary" data-testid="nc-doc-cover-remove" @click="onRemoveCover">
                {{ $t('labels.removeCover') }}
              </NcButton>
            </template>
          </div>
        </div>

        <div
          class="nc-doc-editor-inner w-full mx-auto"
          :class="[isCellMode ? 'px-10' : 'px-4 sm:px-10 lg:px-16', { 'max-w-[900px]': !isFullWidth }]"
          :dir="resolvedDir"
        >
          <!-- Title — hidden in cell mode (the panel header already shows the column name) -->
          <div
            v-if="!isCellMode"
            class="nc-doc-editor-header pb-4"
            :class="embedded ? 'pt-4' : coverImageSrc ? 'pt-12' : 'pt-16 md:pt-12'"
          >
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
                :readonly="isTitleReadonly"
                class="nc-doc-title w-full text-3xl font-semibold outline-none bg-transparent nc-doc-title-input"
                data-testid="docs-page-title"
                :placeholder="$t('general.untitled')"
                dir="auto"
                @blur="onTitleBlur"
                @keydown="onTitleKeydown"
              />
            </div>
            <div class="nc-doc-subtitle flex items-center mt-2 text-sm">
              <span
                v-if="collabEnabled && !collabSynced"
                class="nc-doc-connecting flex items-center gap-1 text-nc-content-gray-muted"
              >
                <GeneralLoader size="small" />
                {{ $t('general.connecting') }}
              </span>
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
              <span
                v-if="!embedded"
                v-e="['c:doc:comments:subtitle-toggle']"
                class="nc-doc-subtitle-comments"
                @click="toggleCommentsPanel()"
              >
                <GeneralIcon icon="ncMessageCircle" class="!w-3.5 !h-3.5" />
                <template v-if="!isMobileMode || !isSaving">
                  <template v-if="commentCount">
                    {{ commentCount }} {{ commentCount === 1 ? $t('general.comment') : $t('general.comments') }}
                  </template>
                  <template v-else>
                    {{ $t('general.comment') }}
                  </template>
                </template>
              </span>
            </div>
          </div>

          <!-- Editor — always mounted so ProseMirror view stays attached -->
          <div
            class="nc-doc-editor-body relative"
            :class="[hasSubDocuments ? 'pb-8' : 'pb-48', { 'pt-6': isCellMode }]"
            :style="docColorVars"
            data-testid="docs-page-content"
            @click="onEditorBodyClick"
          >
            <template v-if="editor">
              <!-- Bubble menu: appears on text selection (including inside table cells) -->
              <BubbleMenu
                v-if="!aiSuggestion.visible"
                :editor="editor"
                :update-delay="250"
                :tippy-options="{ duration: 100, maxWidth: 'none' }"
                :should-show="showRichTextMenu"
              >
                <!-- Cell selection: show cell color picker instead of text formatting -->
                <div v-if="isCellSelection" class="nc-doc-bubble-toolbar flex items-center">
                  <NcDropdown :trigger="['click']" placement="bottomLeft">
                    <NcButton size="small" type="text">
                      <GeneralIcon icon="ncPalette" />
                    </NcButton>
                    <template #overlay>
                      <DocColorPicker
                        :text-colors="TEXT_COLORS"
                        :bg-colors="CELL_BG_COLORS"
                        @text-color="(c) => applyCellColor('cellTextColor', c)"
                        @bg-color="(c) => applyCellColor('bgColor', c)"
                      />
                    </template>
                  </NcDropdown>
                </div>

                <!-- Text selection: formatting toolbar + custom link button -->
                <div v-else class="nc-doc-bubble-toolbar flex items-center">
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
                  <NcTooltip v-if="isEditable && !embedded" placement="top">
                    <template #title>{{ $t('tooltip.addComment') }}</template>
                    <NcButton
                      size="small"
                      type="text"
                      data-testid="nc-doc-comment-add-btn"
                      @mousedown.prevent
                      @click="onAddInlineComment"
                    >
                      <GeneralIcon icon="comment" />
                    </NcButton>
                  </NcTooltip>

                  <!-- AI Actions -->
                  <template v-if="isEeUI && isEditable">
                    <div class="nc-doc-bubble-ai-divider" />
                    <NcDropdown
                      :disabled="!isDocAiConfigured || blockDocAi"
                      trigger="click"
                      placement="bottomLeft"
                      @update:visible="resetAiSubMenus"
                    >
                      <NcTooltip placement="top" :disabled="blockDocAi">
                        <template #title>
                          {{ isDocAiConfigured ? 'NocoAI' : $t('title.noAiIntegrationAvailable') }}
                        </template>
                        <NcButton
                          size="small"
                          type="text"
                          :disabled="!isDocAiConfigured && !blockDocAi"
                          class="nc-doc-ai-btn"
                          data-testid="nc-doc-ai-menu-btn"
                          @mousedown.prevent
                          @click="blockDocAi && showUpgradeToUseDocAi({ triggerSource: 'doc-ai' })"
                        >
                          <GeneralIcon icon="ncAutoAwesome" />
                        </NcButton>
                      </NcTooltip>
                      <template #overlay>
                        <div class="nc-doc-ai-menu" data-testid="nc-doc-ai-menu">
                          <!-- Improve & Fix -->
                          <div
                            v-e="['c:doc:ai:improve:writing']"
                            class="nc-doc-ai-menu-item"
                            data-testid="nc-doc-ai-improve-writing"
                            @click="editor?.storage.docAi?.improve?.('writing')"
                          >
                            <div class="nc-doc-ai-menu-icon">
                              <GeneralIcon icon="ncWandSparkles" />
                            </div>
                            <span class="nc-doc-ai-menu-label">{{ $t('labels.docAiImproveWriting') }}</span>
                          </div>
                          <div
                            v-e="['c:doc:ai:improve:grammar']"
                            class="nc-doc-ai-menu-item"
                            data-testid="nc-doc-ai-improve-grammar"
                            @click="editor?.storage.docAi?.improve?.('grammar')"
                          >
                            <div class="nc-doc-ai-menu-icon">
                              <GeneralIcon icon="ncCheck" />
                            </div>
                            <span class="nc-doc-ai-menu-label">{{ $t('labels.docAiFixGrammar') }}</span>
                          </div>

                          <div class="nc-doc-ai-menu-divider" />

                          <!-- Summarize -->
                          <div
                            v-e="['c:doc:ai:summarize:selection']"
                            class="nc-doc-ai-menu-item"
                            data-testid="nc-doc-ai-summarize"
                            @click="onAiSummarizeSelection"
                          >
                            <div class="nc-doc-ai-menu-icon">
                              <GeneralIcon icon="ncAlignLeft" />
                            </div>
                            <span class="nc-doc-ai-menu-label">{{ $t('labels.docAiSummarize') }}</span>
                          </div>

                          <!-- Translate submenu -->
                          <div class="nc-doc-ai-menu-sub" data-testid="nc-doc-ai-translate-submenu" @mouseenter="positionSubMenu">
                            <div class="nc-doc-ai-menu-item">
                              <div class="nc-doc-ai-menu-icon">
                                <GeneralIcon icon="ncGlobe" />
                              </div>
                              <span class="nc-doc-ai-menu-label">{{ $t('labels.docAiTranslate') }}</span>
                              <GeneralIcon icon="chevronRight" class="nc-doc-ai-menu-arrow" />
                            </div>
                            <div class="nc-doc-ai-menu-sub-panel">
                              <div
                                v-for="lang in docAiTranslateLanguages"
                                :key="lang"
                                v-e="[`c:doc:ai:translate:${lang.toLowerCase()}`]"
                                class="nc-doc-ai-menu-item"
                                :data-testid="`nc-doc-ai-translate-${lang.toLowerCase()}`"
                                @click="editor?.storage.docAi?.translate?.(lang)"
                              >
                                <span class="nc-doc-ai-menu-label">{{ lang }}</span>
                              </div>
                            </div>
                          </div>

                          <!-- Change tone submenu -->
                          <div class="nc-doc-ai-menu-sub" data-testid="nc-doc-ai-tone-submenu" @mouseenter="positionSubMenu">
                            <div class="nc-doc-ai-menu-item">
                              <div class="nc-doc-ai-menu-icon">
                                <GeneralIcon icon="ncMessageCircle" />
                              </div>
                              <span class="nc-doc-ai-menu-label">{{ $t('labels.docAiChangeTone') }}</span>
                              <GeneralIcon icon="chevronRight" class="nc-doc-ai-menu-arrow" />
                            </div>
                            <div class="nc-doc-ai-menu-sub-panel">
                              <div
                                v-for="tone in docAiTones"
                                :key="tone"
                                v-e="[`c:doc:ai:improve:${tone.toLowerCase()}`]"
                                class="nc-doc-ai-menu-item"
                                :data-testid="`nc-doc-ai-tone-${tone.toLowerCase()}`"
                                @click="editor?.storage.docAi?.improve?.(tone.toLowerCase())"
                              >
                                <span class="nc-doc-ai-menu-label">{{ tone }}</span>
                              </div>
                            </div>
                          </div>

                          <div class="nc-doc-ai-menu-divider" />

                          <!-- Make shorter / longer -->
                          <div
                            v-e="['c:doc:ai:improve:shorter']"
                            class="nc-doc-ai-menu-item"
                            data-testid="nc-doc-ai-make-shorter"
                            @click="editor?.storage.docAi?.improve?.('shorter')"
                          >
                            <div class="nc-doc-ai-menu-icon">
                              <GeneralIcon icon="ncMinimize" />
                            </div>
                            <span class="nc-doc-ai-menu-label">{{ $t('labels.docAiMakeShorter') }}</span>
                          </div>
                          <div
                            v-e="['c:doc:ai:improve:longer']"
                            class="nc-doc-ai-menu-item"
                            data-testid="nc-doc-ai-make-longer"
                            @click="editor?.storage.docAi?.improve?.('longer')"
                          >
                            <div class="nc-doc-ai-menu-icon">
                              <GeneralIcon icon="ncMaximize" />
                            </div>
                            <span class="nc-doc-ai-menu-label">{{ $t('labels.docAiMakeLonger') }}</span>
                          </div>
                        </div>
                      </template>
                    </NcDropdown>
                  </template>
                </div>
              </BubbleMenu>

              <div v-show="!showLegacyFallback" ref="editorContentRef" class="relative">
                <EditorContent :editor="editor" @click="onEditorClick" />

                <!-- Link hover preview -->
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
                <div
                  v-if="isLinkEditOpen"
                  :style="linkHoverStyle"
                  class="nc-link-edit-popover"
                  @mouseenter="keepLinkHoverAlive"
                  @keydown.stop
                  @paste.stop
                >
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

                <!-- AI Suggestion Popup — floats below selection after bubble menu AI action -->
                <DocAiSuggestionPopup
                  v-if="aiSuggestion.visible"
                  ref="aiSuggestionPopupRef"
                  :style="aiSuggestionStyle"
                  :loading="aiSuggestion.loading"
                  :result="aiSuggestion.result"
                  :error="aiSuggestion.error"
                  :operation-label="aiSuggestion.operationLabel"
                  :inline-mode="aiSuggestion.inlineMode"
                  @accept="onAiSuggestionAccept"
                  @discard="onAiSuggestionDiscard"
                  @try-again="onAiSuggestionTryAgain"
                  @insert-below="onAiSuggestionInsertBelow"
                  @stop="onAiSuggestionStop"
                />
              </div>

              <DocReadonlyBody v-if="showLegacyFallback" :content="legacyFallbackContent" />

              <!-- Table context menus: column/row handles + dropdown menus (hidden for read-only users) -->
              <DocTableMenu v-if="isEditable" :editor="editor" />
            </template>
          </div>

          <!-- Sub documents — direct children of the current doc, rendered after content -->
          <DocSubDocumentsList v-if="isLoaded" :doc-id="docId" :base-id="base?.id" />
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

    <!-- Comments sidebar — drawer on mobile, inline panel on desktop. Cell mode skips entirely. -->
    <NcDrawer
      v-if="!isCellMode && isMobileMode"
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
      v-else-if="!isCellMode && isCommentsPanelOpen"
      :doc-id="docId"
      :base-id="base?.id"
      :editor="editor"
      :pending-selection="pendingInlineCommentSelection"
      @close="isCommentsPanelOpen = false"
      @clear-pending-selection="pendingInlineCommentSelection = null"
    />

    <!-- Share modal mount point — keeps the share-and-collaborate dialog
         available when the doc page is open. The dispatcher renders the doc
         branch when activeDocument is set. -->
    <LazyDlgShareAndCollaborateView v-if="!embedded && !isCellMode" />

    <!-- History modal: list + diff viewer in one surface. -->
    <DocHistoryModal v-if="!isCellMode" v-model:visible="isHistoryModalOpen" :doc-id="docId" />
  </div>
</template>

<style lang="scss">
// Loaded at the top per Sass 3.0 rules — the actual styles are emitted
// later in the file via `@include doc.doc-content` so they cascade after
// the editor chrome rules below.
@use './_doc-content' as doc;

.nc-doc-editor {
  background: var(--nc-bg-default);
  // Definite height so inner overflow-y-auto activates and only the editor content scrolls.
  // The h-full chain breaks at a-layout-content — this bypasses it.
  height: 100vh;
  height: 100dvh;
}

// Dark-mode overrides for the code-block CSS variables. This MUST target the
// same element the light defaults are declared on (`.nc-doc-editor-content.ProseMirror`,
// further down) — NOT the outer `.nc-doc-editor`. Custom properties resolve to
// the nearest ancestor that sets them, so an override on the higher
// `.nc-doc-editor` is shadowed by the unconditional light defaults on the
// closer ProseMirror element, leaving code blocks white in dark mode. NocoDB
// sets `theme='dark'` on `<html>` via `useTheme()`, so this flips automatically.
[theme='dark'] .nc-doc-editor-content.ProseMirror {
  --nc-code-block-bg: #1f2937;
  --nc-code-block-text: #f9fafb;
  --nc-code-block-keyword: #ff7b72;
  --nc-code-block-title: #d2a8ff;
  --nc-code-block-attr: #79c0ff;
  --nc-code-block-string: #a5d6ff;
  --nc-code-block-built-in: #ffa657;
  --nc-code-block-comment: #8b949e;
  --nc-code-block-name: #7ee787;
  --nc-code-block-section: #1f6feb;
  --nc-code-block-toolbar-bg: rgba(255, 255, 255, 0.1);
  --nc-code-block-toolbar-bg-hover: rgba(255, 255, 255, 0.15);
  --nc-code-block-toolbar-fg: rgba(255, 255, 255, 0.6);
  --nc-code-block-toolbar-fg-hover: rgba(255, 255, 255, 0.9);
}

// Real-time collaboration cursors (TipTap's CollaborationCursor ships no CSS).
// The caret is absolutely positioned so it takes up no inline space: an in-flow
// caret splits the text node it sits in, which both adds a visible gap and breaks
// native double-click word selection across a peer's cursor. `pointer-events: none`
// keeps it purely decorative so it can never steal a click from the local editor.
.nc-doc-editor-content {
  .collaboration-cursor__caret {
    position: absolute;
    width: 0;
    border-left: 2px solid;
    height: 1.2em; // explicit height so the zero-width caret renders a visible bar
    word-break: normal;
    pointer-events: none;
  }

  .collaboration-cursor__label {
    position: absolute;
    top: -1.8em;
    left: -1px;
    z-index: 20;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    font-style: normal;
    line-height: normal;
    white-space: nowrap;
    color: #fff;
    user-select: none;
    pointer-events: none;
  }
}

// Cell mode (SmartText panel): zero out the first child's top margin so a
// leading heading doesn't stack ~33px on top of the body's pt-6 padding.
// Doc mode keeps the heading rhythm because the title block sits above.
.nc-doc-editor-cell {
  .nc-doc-editor-content.ProseMirror > *:first-child {
    margin-top: 0 !important;
  }
}

// Hide the block drag handle inside a non-fullscreen SmartText panel.
// The narrow panel doesn't have room for handle + heading label + chevron in
// the left gutter. In fullscreen mode there's plenty of horizontal space, so
// the handle stays available for users reorganizing longer cells.
.nc-smart-text-panel:not(.nc-smart-text-fullscreen) .nc-doc-drag-handle {
  display: none !important;
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

  .nc-doc-bubble-ai-divider {
    @apply w-px h-4 mx-0.5 bg-nc-border-gray-medium;
  }

  .nc-doc-ai-btn:hover {
    @apply !text-nc-content-brand;
  }
}

// AI dropdown menu — matches slash command menu styling
// Ensure the Ant dropdown overlay doesn't clip sub-menus
:global(.ant-dropdown:has(.nc-doc-ai-menu)) {
  overflow: visible !important;
}

.nc-doc-ai-menu {
  background: var(--nc-bg-default);
  border-radius: 8px;
  padding: 4px 0;
  min-width: 220px;
  border: 1px solid var(--nc-border-gray-medium);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  overflow: visible;
}

.nc-doc-ai-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  cursor: pointer;
  transition: background-color 0.12s ease;

  &:hover {
    background-color: var(--nc-bg-gray-light);
  }
}

.nc-doc-ai-menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  flex-shrink: 0;
  color: var(--nc-content-gray-subtle);

  svg {
    width: 16px;
    height: 16px;
  }
}

.nc-doc-ai-menu-label {
  font-size: 13px;
  font-weight: 400;
  color: var(--nc-content-gray);
  line-height: 1;
}

.nc-doc-ai-menu-divider {
  height: 1px;
  background: var(--nc-border-gray-medium);
  margin: 4px 12px;
}

.nc-doc-ai-menu-arrow {
  margin-left: auto;
  width: 14px;
  height: 14px;
  color: var(--nc-content-gray-muted);
  flex-shrink: 0;
}

.nc-doc-ai-menu-sub {
  position: relative;

  > .nc-doc-ai-menu-sub-panel {
    display: none;
    position: absolute;
    left: 100%;
    top: 0;
    background: var(--nc-bg-default);
    border-radius: 8px;
    padding: 4px 0;
    min-width: 180px;
    border: 1px solid var(--nc-border-gray-medium);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    z-index: 60;
  }

  &:hover > .nc-doc-ai-menu-item {
    background-color: var(--nc-bg-gray-light);
  }
}

// Link input bubble menus
.nc-doc-editor-body .nc-doc-link-input {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

  .nc-button {
    @apply !my-auto;
  }
}

// --- Link hover preview ---
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
  // gap-0.5 (2px) keeps the action cluster tight now that Share has been
  // promoted out of the menu — three icon buttons sit side-by-side in the
  // topbar, gap-2 (8px) made the group feel sparse.
  @apply h-[var(--topbar-height)] flex items-center gap-0.5 absolute top-0 right-3 z-20;
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
  // Logical properties so the icon's hanging-outside-the-content position
  // flips correctly when the doc is rendered RTL.
  margin-inline-end: 4px;

  @media (min-width: 1024px) {
    margin-inline-start: -48px;
    margin-inline-end: 8px;
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

    &.nc-toolbar-delete {
      position: relative;
      color: var(--nc-content-gray-muted);
      margin-left: 11px;

      &::before {
        content: '';
        position: absolute;
        left: -7px;
        top: 4px;
        bottom: 4px;
        width: 1px;
        background: var(--nc-border-gray-medium);
      }

      &:hover {
        background: var(--nc-bg-coloured-red);
        color: var(--nc-content-red-dark);
      }
    }
  }
}

// Content rendering styles for the .nc-doc-editor-content.ProseMirror root
// live in a shared partial so the read-only history Viewer renders identically.
// The mixin is included here (rather than at the top of the file) so the
// content rules land after the editor chrome above and override it where
// the selectors overlap.
@include doc.doc-content;

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

  .nc-doc-embedded & {
    margin-top: 0;
  }
}

.nc-doc-cover-image {
  width: 100%;
  height: 240px;
  object-fit: cover;
  // object-position set inline (vertical focal point); defaults to center 50%
  user-select: none;
}

.nc-doc-cover-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s;

  .group:hover &,
  .nc-doc-cover-repositioning & {
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

// Reposition mode: hint pill + subtle dim so the drag affordance is clear
.nc-doc-cover-repositioning {
  .nc-doc-cover-image {
    filter: brightness(0.92);
  }
}

.nc-doc-cover-hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  pointer-events: none;
  white-space: nowrap;
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

// Direction selector row in page menu
.nc-doc-dir-selector-label {
  padding: 6px 12px 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--nc-content-gray-subtle);
}

.nc-doc-dir-selector {
  display: flex;
  gap: 8px;
  padding: 0 12px 8px;
}

.nc-doc-dir-option {
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

  &.nc-doc-dir-option-active {
    border-color: var(--nc-content-brand);

    .nc-doc-dir-icon,
    .nc-doc-dir-label {
      color: var(--nc-content-brand);
    }
  }
}

.nc-doc-dir-icon {
  width: 16px;
  height: 16px;
  color: var(--nc-content-gray);
}

.nc-doc-dir-label {
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

/* AI-generated content highlight — applied via ProseMirror decoration */
.nc-doc-ai-generated {
  background-color: rgba(245, 158, 11, 0.1);
  border-bottom: 1px solid rgba(245, 158, 11, 0.3);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.dark .nc-doc-ai-generated {
  background-color: rgba(251, 191, 36, 0.1);
  border-bottom-color: rgba(251, 191, 36, 0.25);
}

.nc-doc-ai-fadeout {
  background-color: transparent !important;
  border-bottom-color: transparent !important;
  transition: background-color 0.5s ease, border-bottom-color 0.5s ease;
}
</style>
