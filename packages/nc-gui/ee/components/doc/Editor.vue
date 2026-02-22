<script setup lang="ts">
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { CellSelection } from '@tiptap/pm/tables'
import { marked } from 'marked'
import { DOMParser as PmDOMParser } from '@tiptap/pm/model'
import { SlashCommandExtension } from './SlashCommand'
import { CalloutExtension } from './CalloutExtension'
import type { DocType } from 'nocodb-sdk'
import { timeAgo } from '~/utils/datetimeUtils'

const props = defineProps<{
  docId: string
}>()

const docId = toRef(props, 'docId')

const docsStore = useDocsStore()
const { loadDoc, updateDoc } = docsStore

const basesStore = useBases()
const { activeProjectId, basesUser } = storeToRefs(basesStore)

const { user } = useGlobal()

const base = inject(ProjectInj, ref())

// Resolve created_by user ID to display name
const idUserMap = computed<Record<string, any>>(() => {
  if (!base.value?.id) return {}
  return (basesUser.value.get(base.value.id) || []).reduce((acc: Record<string, any>, u: any) => {
    acc[u.id] = u
    acc[u.email] = u
    return acc
  }, {})
})

const resolveUserLabel = (userId?: string) => {
  if (!userId) return ''
  const u = idUserMap.value[userId]
  if (!u) return ''
  if (u.id === user.value?.id) return 'you'
  return u.display_name || u.email || ''
}

const createdByLabel = computed(() => resolveUserLabel(doc.value?.created_by))

const updatedByLabel = computed(() => resolveUserLabel(doc.value?.updated_by))

const updatedAgo = computed(() => {
  const ts = doc.value?.updated_at
  if (!ts) return ''
  return timeAgo(ts)
})

const doc = ref<DocType | null>(null)
const title = ref('')
const isSaving = ref(false)
const isLoaded = ref(false)
const titleInput = useTemplateRef('titleInput')

const saveTimeout = ref<NodeJS.Timeout>()

// Guard: suppress onUpdate saves while we're programmatically loading content
// into the editor (setContent triggers onUpdate, which would queue a no-op save).
const isSettingContent = ref(false)

/** Show rich text bubble menu on any non-empty text selection (including inside table cells),
 *  but NOT on multi-cell CellSelection (that gets the table toolbar instead). */
const showRichTextMenu = ({ editor: e }: { editor: any }) => {
  const { selection } = e.state
  if (selection instanceof CellSelection) return false
  return !selection.empty
}

/** Show table toolbar only on multi-cell CellSelection (shift-click / drag across cells). */
const showTableToolbar = ({ editor: e }: { editor: any }) => {
  return e.state.selection instanceof CellSelection
}

/** Persist current editor state + title to the backend. */
const save = async () => {
  if (!doc.value || !activeProjectId.value || !editor.value) return

  isSaving.value = true
  try {
    const content = editor.value.getJSON()
    const updated = await updateDoc(activeProjectId.value, doc.value.id!, {
      title: title.value || 'Untitled',
      content,
      version: doc.value.version,
    })

    // Advance local doc fields to match server response
    if (updated) {
      doc.value.version = updated.version
      doc.value.updated_at = updated.updated_at
      doc.value.updated_by = updated.updated_by
    }
  } catch (_e) {
    // Error already surfaced by store's updateDoc via message.error
  } finally {
    isSaving.value = false
  }
}

const debouncedSave = () => {
  // Skip saves triggered by programmatic setContent during page load
  if (isSettingContent.value) return

  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
  }
  saveTimeout.value = setTimeout(save, 2000)
}

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
  ]
  // Require at least 2 matches to avoid false positives on simple text
  let hits = 0
  for (const p of patterns) {
    if (p.test(text)) hits++
    if (hits >= 2) return true
  }
  return false
}

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: 'Start writing or type / for commands...' }),
    Image,
    // TODO Phase-2: TaskList + TaskItem (needs task list CSS that doesn't conflict with prose)
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    SlashCommandExtension,
    CalloutExtension,
  ],
  editorProps: {
    attributes: {
      class: 'nc-doc-editor-content focus:outline-none min-h-[200px]',
    },
    handleKeyDown(view, event) {
      if (event.key !== 'Backspace') return false

      const { state } = view
      const { selection } = state
      const { $from, empty } = selection

      // Only handle when cursor is collapsed (no selection range)
      if (!empty) return false

      // Check if cursor is at the very start of the current block node
      if ($from.parentOffset !== 0) return false

      const node = $from.parent
      const nodeType = node.type.name

      // For headings / code blocks: convert to paragraph (strip formatting)
      if (nodeType === 'heading' || nodeType === 'codeBlock') {
        const from = $from.before() + 1
        const to = from + node.content.size
        view.dispatch(state.tr.setBlockType(from, to, state.schema.nodes.paragraph))
        return true
      }

      return false
    },
    handlePaste(view, event) {
      // If clipboard contains HTML (e.g. pasting from a browser / rich editor),
      // let Tiptap's default handler deal with it.
      const html = event.clipboardData?.getData('text/html')
      if (html) return false

      const text = event.clipboardData?.getData('text/plain')
      if (!text || !looksLikeMarkdown(text)) return false

      // Convert markdown → HTML, then let ProseMirror parse it into a doc slice
      const converted = marked.parse(text, { async: false }) as string
      const wrapper = document.createElement('div')
      wrapper.innerHTML = converted

      const parser = PmDOMParser.fromSchema(view.state.schema)
      const slice = parser.parseSlice(wrapper)

      view.dispatch(view.state.tr.replaceSelection(slice))
      return true
    },
  },
  onUpdate: () => {
    debouncedSave()
  },
})

/**
 * Wait for the Tiptap editor to be available.
 * `useEditor` creates the Editor instance inside `onMounted`, so
 * `editor.value` is `undefined` during setup and the first immediate
 * watch execution. This helper polls via `nextTick` until the editor
 * exists (typically resolves after the first mount tick).
 */
const waitForEditor = (): Promise<void> => {
  return new Promise((resolve) => {
    if (editor.value) return resolve()

    const unwatch = watch(editor, (val) => {
      if (val) {
        unwatch()
        resolve()
      }
    })
  })
}

/**
 * Parse content from the API response into a Tiptap-compatible JSON object.
 * The backend should return parsed JSON, but we defensively handle string
 * values in case of cache inconsistencies.
 */
const parseContent = (content: unknown): Record<string, any> | null => {
  if (!content) return null
  if (typeof content === 'object') return content as Record<string, any>
  if (typeof content === 'string') {
    try {
      return JSON.parse(content)
    } catch {
      console.error('[doc:editor] failed to parse content JSON')
      return null
    }
  }
  return null
}

const loadAndSetDoc = async (id: string) => {
  // Flush any pending save for the *previous* page before switching
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
    await save()
  }

  isLoaded.value = false
  const loaded = await loadDoc(id)

  if (loaded) {
    doc.value = loaded
    // Treat "Untitled" as empty — it's the server default, not a user-provided name
    title.value = loaded.title === 'Untitled' ? '' : (loaded.title || '')

    const parsed = parseContent(loaded.content)
    if (parsed) {
      // useEditor creates the instance in onMounted — wait for it on first load
      await waitForEditor()

      // Suppress onUpdate → debouncedSave while loading content programmatically
      isSettingContent.value = true
      editor.value!.commands.setContent(parsed)

      // Wait a tick for ProseMirror to finish its transaction cycle
      // before re-enabling user-edit saves
      await nextTick()
      isSettingContent.value = false
    }
  }
  isLoaded.value = true

  // Auto-focus the title input on new (untitled) pages so the user
  // can immediately start typing a name
  if (!title.value) {
    nextTick(() => {
      ;(titleInput.value as HTMLInputElement)?.focus()
    })
  }
}

// Re-load doc when navigating between pages
watch(
  docId,
  async (newId) => {
    if (newId) {
      await loadAndSetDoc(newId)
    }
  },
  { immediate: true },
)

const onTitleBlur = () => {
  // Compare effective titles — empty input maps to "Untitled" on save
  const effectiveTitle = title.value || 'Untitled'
  if (effectiveTitle !== doc.value?.title) {
    debouncedSave()
  }
}

const onTitleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    editor.value?.commands.focus('start')
  }
}

onBeforeUnmount(() => {
  // Flush any pending save before the editor is destroyed.
  // Capture content synchronously BEFORE destroy() tears down ProseMirror,
  // then fire the async save with the captured snapshot.
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
    if (doc.value && activeProjectId.value && editor.value) {
      const content = editor.value.getJSON()
      const docId = doc.value.id!
      const version = doc.value.version
      const docTitle = title.value || 'Untitled'
      const baseId = activeProjectId.value
      // Fire-and-forget is acceptable here — content is already captured
      updateDoc(baseId, docId, { title: docTitle, content, version })
    }
  }
  editor.value?.destroy()
})
</script>

<template>
  <!-- Show loader only on initial load (no doc fetched yet) -->
  <div v-if="!isLoaded && !doc" class="flex items-center justify-center h-full">
    <GeneralLoader />
  </div>

  <!--
    Keep the editor mounted across page switches to avoid detaching
    ProseMirror's view from the DOM. Content is swapped via setContent.
  -->
  <div v-else class="nc-doc-editor flex flex-col h-full w-full overflow-y-auto">
    <div class="nc-doc-editor-inner w-full max-w-[900px] mx-auto px-6 sm:px-10 lg:px-16">
      <!-- Title -->
      <div class="nc-doc-editor-header pt-12 pb-4">
        <input
          ref="titleInput"
          v-model="title"
          class="nc-doc-title w-full text-3xl font-semibold outline-none bg-transparent nc-doc-title-input"
          placeholder="Untitled"
          @blur="onTitleBlur"
          @keydown="onTitleKeydown"
        />
        <div class="nc-doc-subtitle flex items-center gap-1 mt-2 text-sm">
          <template v-if="createdByLabel">
            <span>Created by {{ createdByLabel }}</span>
          </template>
          <template v-if="updatedByLabel && updatedAgo">
            <span v-if="createdByLabel">&middot;</span>
            <span>Updated by {{ updatedByLabel }} {{ updatedAgo }}</span>
          </template>
          <template v-if="isSaving">
            <span v-if="createdByLabel || updatedByLabel">&middot;</span>
            <span>Saving...</span>
          </template>
        </div>
      </div>

      <!-- Editor — always mounted so ProseMirror view stays attached -->
      <div class="nc-doc-editor-body pb-48">
        <template v-if="editor">
          <!-- Bubble menu: appears on text selection (including inside table cells) -->
          <BubbleMenu
            :editor="editor"
            :update-delay="250"
            :tippy-options="{ duration: 100, maxWidth: 600 }"
            :should-show="showRichTextMenu"
          >
            <CellRichTextSelectedBubbleMenu
              :editor="editor"
              embed-mode
              hide-mention
              :hidden-options="[RichTextBubbleMenuOptions.taskList]"
            />
          </BubbleMenu>

          <!-- Table toolbar: appears on text/cell selection inside a table -->
          <BubbleMenu
            :editor="editor"
            :tippy-options="{ duration: 100, maxWidth: 700, placement: 'top' }"
            :should-show="showTableToolbar"
          >
            <DocTableToolbar :editor="editor" />
          </BubbleMenu>

          <EditorContent :editor="editor" />
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.nc-doc-editor {
  background: var(--nc-bg-default);
}

// Doc editor bubble menu — override embed-mode's transparent/no-shadow defaults
.nc-doc-editor-body .bubble-menu.embed-mode {
  @apply !rounded-lg;
  border: 1px solid #d1d5db !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
}

// Table context toolbar — same visual treatment as the text bubble menu
.nc-doc-table-toolbar {
  border: 1px solid #d1d5db;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

// Subtitle (created by / updated by) — match Outline's muted slate
.nc-doc-subtitle {
  color: #9BA6B2;
}

// Title placeholder — lighter than muted to feel like a watermark
.nc-doc-title-input::placeholder {
  color: #d1d5db;
  opacity: 1;
}

// Doc editor typography — no prose class, clean styles
.nc-doc-editor-content.ProseMirror {
  min-height: 200px;
  font-size: 0.95rem;
  line-height: 1.7;
  color: #1f2937;

  > * + * {
    margin-top: 0.75em;
  }

  // Headings — H1/H2/H3 prefix labels sit outside via absolute positioning
  h1, h2, h3 {
    position: relative;
    color: #111827;

    &::before {
      position: absolute;
      right: 100%;
      margin-right: 0.5em;
      color: #9BA6B2;
      font-size: 12px;
      font-weight: 500;
      top: 50%;
      transform: translateY(-50%);
    }
  }

  h1 {
    font-size: 1.625em;
    font-weight: 600;
    margin-top: 1.4em;
    margin-bottom: 0.4em;
    line-height: 1.3;
    &::before { content: 'H1'; }
  }

  h2 {
    font-size: 1.3em;
    font-weight: 600;
    margin-top: 1.2em;
    margin-bottom: 0.35em;
    line-height: 1.35;
    &::before { content: 'H2'; }
  }

  h3 {
    font-size: 1.125em;
    font-weight: 600;
    margin-top: 1em;
    margin-bottom: 0.3em;
    line-height: 1.4;
    &::before { content: 'H3'; }
  }

  // Placeholder
  p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: #d1d5db;
    pointer-events: none;
    height: 0;
  }

  // Lists
  ul {
    list-style-type: disc;
    padding-left: 1.5em;
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

  // Blockquote
  blockquote {
    border-left: 3px solid #d1d5db;
    padding-left: 1em;
    color: #6b7280;
    margin: 0.75em 0;
  }

  // Code
  code {
    background-color: #f3f4f6;
    border-radius: 0.25em;
    padding: 0.15em 0.3em;
    font-size: 0.875em;
  }

  pre {
    background-color: #1f2937;
    color: #f9fafb;
    border-radius: 0.5em;
    padding: 0.75em 1em;
    overflow-x: auto;

    code {
      background: none;
      padding: 0;
      color: inherit;
      font-size: inherit;
    }
  }

  // Horizontal rule
  hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 1.5em 0;
  }

  // Links
  a {
    color: #2563eb;
    text-decoration: underline;
  }

  // Table — border-separate so border-radius works on corners
  table {
    border-collapse: separate;
    border-spacing: 0;
    margin: 0;
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
      text-align: left;
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
      background: rgba(59, 130, 246, 0.08);
      pointer-events: none;
      z-index: 2;
    }

    // Column resize handle
    .column-resize-handle {
      position: absolute;
      right: -2px;
      top: 0;
      bottom: -2px;
      width: 4px;
      background-color: #3b82f6;
      pointer-events: none;
    }
  }

  // Resize cursor when hovering over column borders
  &.resize-cursor {
    cursor: col-resize;
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

    &.nc-callout-note {
      background: #eff6ff;
      border-left-color: #3b82f6;
    }

    &.nc-callout-warning {
      background: #fffbeb;
      border-left-color: #f59e0b;
    }

    &.nc-callout-tip {
      background: #f0fdf4;
      border-left-color: #22c55e;
    }

    &.nc-callout-important {
      background: #fef2f2;
      border-left-color: #ef4444;
    }
  }
}
</style>
