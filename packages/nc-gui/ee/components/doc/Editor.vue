<script setup lang="ts">
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { DocImageExtension } from './DocImageExtension'
import { DocFileAttachmentExtension } from './DocFileAttachmentExtension'
import { DocEmbedExtension } from './DocEmbedExtension'
import { getEmbedURL } from '~/extensions/url-preview-ee/utils'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { CellSelection } from '@tiptap/pm/tables'
import { marked } from 'marked'
import { DOMParser as PmDOMParser } from '@tiptap/pm/model'
import { SlashCommandExtension } from './SlashCommand'
import { CalloutExtension } from './CalloutExtension'
import { useDocImageUpload } from '~/ee/composables/useDocImageUpload'
import { useDocFileUpload } from '~/ee/composables/useDocFileUpload'
import type { DocType } from 'nocodb-sdk'
import { timeAgo } from '~/utils/datetimeUtils'

// Override TableCell & TableHeader to ignore colwidth — we use CSS table-layout:fixed
// for equal columns instead of pixel widths (which go stale on column add/delete).
const DocTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...TableCell.config.addAttributes?.call(this),
      colwidth: { default: null, renderHTML: () => ({}) },
    }
  },
})
const DocTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...TableHeader.config.addAttributes?.call(this),
      colwidth: { default: null, renderHTML: () => ({}) },
    }
  },
})

const props = defineProps<{
  docId: string
}>()

const docId = toRef(props, 'docId')

const docsStore = useDocsStore()
const { loadDoc, updateDoc, deleteDoc, createDoc } = docsStore

const basesStore = useBases()
const { activeProjectId, basesUser } = storeToRefs(basesStore)

const { user } = useGlobal()
const { isUIAllowed } = useRoles()
const { openFilePicker, uploadAndInsert } = useDocImageUpload()
const { openFilePicker: openFileAttachmentPicker, uploadAndInsert: uploadAndInsertFile } = useDocFileUpload()

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
 *  but NOT on multi-cell CellSelection or image NodeSelection (those have their own UI). */
const showRichTextMenu = ({ editor: e }: { editor: any }) => {
  const { selection } = e.state
  if (selection instanceof CellSelection) return false
  // Hide for image / file attachment selections — they have their own UI
  if (selection.node?.type.name === 'image' || selection.node?.type.name === 'fileAttachment' || selection.node?.type.name === 'embed') return false
  return !selection.empty
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

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: 'Start writing or type / for commands...' }),
    DocImageExtension,
    // TODO Phase-2: TaskList + TaskItem (needs task list CSS that doesn't conflict with prose)
    // resizable: false — the columnResizing plugin's TableView node view causes
    // ProseMirror decoration tracking crashes (localsInner/eq undefined) on any
    // structural table change (delete col/row, cell selection). Tables use CSS
    // table-layout: fixed with equal-width columns instead.
    Table.configure({ resizable: false }),
    TableRow,
    DocTableCell,
    DocTableHeader,
    SlashCommandExtension,
    CalloutExtension,
    DocFileAttachmentExtension,
    DocEmbedExtension,
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
        const pos = $from.before()
        view.dispatch(state.tr.setBlockType(pos, pos + $from.parent.nodeSize - 2, state.schema.nodes.paragraph))
        return true
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

      if (!images.length && !nonImages.length) return false

      event.preventDefault()
      const ed = editor.value
      if (ed) {
        // Position cursor at drop point
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (pos) ed.commands.setTextSelection(pos.pos)

        for (const img of images) {
          uploadAndInsert(ed, img)
        }
        for (const file of nonImages) {
          uploadAndInsertFile(ed, file)
        }
      }
      return true
    },
    handlePaste(view, event) {
      // Check for pasted image files (e.g. screenshot from clipboard)
      const files = Array.from(event.clipboardData?.files || [])
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (images.length) {
        event.preventDefault()
        const ed = editor.value
        if (ed) {
          for (const img of images) {
            uploadAndInsert(ed, img)
          }
        }
        return true
      }

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

// Register the slash command upload triggers once the editor is available.
// The slash commands call editor.storage.{type}.openUpload() which we wire here.
watch(editor, (ed) => {
  if (ed?.storage?.image) {
    ed.storage.image.openUpload = async () => {
      const file = await openFilePicker()
      if (file) uploadAndInsert(ed, file)
    }
  }
  if (ed?.storage?.fileAttachment) {
    ed.storage.fileAttachment.openUpload = async () => {
      const file = await openFileAttachmentPicker()
      if (file) uploadAndInsertFile(ed, file)
    }
  }
  if (ed?.storage?.embed) {
    ed.storage.embed.insertFromUrl = (editor: any, url: string) => {
      const [platform, embedUrl] = getEmbedURL(url.trim())
      if (platform === 'unsupported' || embedUrl === 'unsupported') {
        message.warning('URL not supported for embedding. Try a YouTube, Vimeo, or Loom link.')
        return
      }

      editor.chain().focus().insertEmbed({ src: embedUrl, url: url.trim(), platform }).run()
    }
  }
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

// --- Page context menu (3-dot) ---
const isPageMenuOpen = ref(false)

const onCopyPageId = () => {
  if (!doc.value?.id) return
  navigator.clipboard.writeText(doc.value.id)
  message.success('Page ID copied')
  isPageMenuOpen.value = false
}

const onDuplicatePage = async () => {
  isPageMenuOpen.value = false
  if (!base.value?.id || !doc.value?.id) return

  const fullDoc = await loadDoc(doc.value.id, false)
  if (!fullDoc) return

  await createDoc(base.value.id, {
    title: `${fullDoc.title || 'Untitled'} (copy)`,
    content: fullDoc.content,
  })
}

const isDeleteModalOpen = ref(false)

const onDeletePage = () => {
  isPageMenuOpen.value = false
  isDeleteModalOpen.value = true
}

const confirmDeletePage = async () => {
  if (!base.value?.id || !doc.value?.id) return
  await deleteDoc(base.value.id, doc.value.id)
}

// --- Download helpers ---
const fileName = computed(() => (title.value || 'Untitled').replace(/[/\\?%*:|"<>]/g, '-'))

const downloadFile = (content: string, ext: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName.value}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

/** Convert an HTML string to markdown using DOM traversal. */
const htmlToMarkdown = (html: string): string => {
  const div = document.createElement('div')
  div.innerHTML = html

  const convert = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''

    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const children = Array.from(el.childNodes).map(convert).join('')

    switch (tag) {
      case 'h1': return `# ${children}\n\n`
      case 'h2': return `## ${children}\n\n`
      case 'h3': return `### ${children}\n\n`
      case 'p': return `${children}\n\n`
      case 'br': return '\n'
      case 'strong': case 'b': return `**${children}**`
      case 'em': case 'i': return `*${children}*`
      case 'u': return children
      case 's': case 'del': return `~~${children}~~`
      case 'code':
        // Inline code vs code inside pre
        if (el.parentElement?.tagName.toLowerCase() === 'pre') return children
        return `\`${children}\``
      case 'pre': return `\`\`\`\n${children}\n\`\`\`\n\n`
      case 'blockquote': return children.split('\n').filter(Boolean).map((l) => `> ${l}`).join('\n') + '\n\n'
      case 'hr': return '---\n\n'
      case 'a': return `[${children}](${el.getAttribute('href') || ''})`
      case 'img': return `![${el.getAttribute('alt') || ''}](${el.getAttribute('src') || ''})`
      case 'ul':
        return Array.from(el.children).map((li) => `- ${convert(li).trim()}`).join('\n') + '\n\n'
      case 'ol':
        return Array.from(el.children).map((li, i) => `${i + 1}. ${convert(li).trim()}`).join('\n') + '\n\n'
      case 'li': return children
      case 'table': {
        const rows = Array.from(el.querySelectorAll('tr'))
        if (!rows.length) return ''
        const toRow = (row: Element) =>
          Array.from(row.querySelectorAll('td, th')).map((c) => convert(c).trim())
        const headerCells = toRow(rows[0])
        const separator = headerCells.map(() => '---')
        const body = rows.slice(1).map((r) => `| ${toRow(r).join(' | ')} |`).join('\n')
        return `| ${headerCells.join(' | ')} |\n| ${separator.join(' | ')} |\n${body}\n\n`
      }
      default: return children
    }
  }

  return Array.from(div.childNodes).map(convert).join('').replace(/\n{3,}/g, '\n\n').trim()
}

const onDownloadMarkdown = () => {
  isPageMenuOpen.value = false
  if (!editor.value) return
  const md = `# ${title.value || 'Untitled'}\n\n${htmlToMarkdown(editor.value.getHTML())}`
  downloadFile(md, 'md', 'text/markdown;charset=utf-8')
}

const onDownloadHTML = () => {
  isPageMenuOpen.value = false
  if (!editor.value) return
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title.value || 'Untitled'}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1f2937; line-height: 1.7; }
  h1 { font-size: 2em; margin-bottom: 0.5em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  td, th { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; color: #6b7280; }
  code { background: #f3f4f6; border-radius: 4px; padding: 2px 6px; font-size: 0.9em; }
  pre { background: #1f2937; color: #f9fafb; border-radius: 8px; padding: 16px; overflow-x: auto; }
  pre code { background: none; padding: 0; color: inherit; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
  a { color: #2563eb; }
</style>
</head>
<body>
<h1>${title.value || 'Untitled'}</h1>
${editor.value.getHTML()}
</body>
</html>`
  downloadFile(html, 'html', 'text/html;charset=utf-8')
}

const onDownloadPDF = () => {
  isPageMenuOpen.value = false
  if (!editor.value) return
  // Open a print-ready window with styled content, then trigger print-to-PDF
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title.value || 'Untitled'}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; color: #1f2937; line-height: 1.7; font-size: 14px; }
  h1 { font-size: 1.8em; margin-bottom: 0.5em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  td, th { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; color: #6b7280; }
  code { background: #f3f4f6; border-radius: 4px; padding: 2px 6px; font-size: 0.9em; }
  pre { background: #1f2937; color: #f9fafb; border-radius: 8px; padding: 16px; overflow-x: auto; }
  pre code { background: none; padding: 0; color: inherit; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
  a { color: #2563eb; text-decoration: underline; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>${title.value || 'Untitled'}</h1>
${editor.value.getHTML()}
<script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
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
    <!-- 3-dot page context menu — pinned to top-right of editor -->
    <div class="nc-doc-page-menu">
      <NcDropdown v-model:visible="isPageMenuOpen" placement="bottomRight">
        <NcButton size="xsmall" type="text" @click.stop="isPageMenuOpen = !isPageMenuOpen">
          <GeneralIcon icon="threeDotHorizontal" />
        </NcButton>
        <template #overlay>
          <NcMenu variant="small" class="!min-w-52">
            <NcMenuItem @click="onCopyPageId">
              <GeneralIcon class="text-nc-content-gray-subtle" icon="copy" />
              Copy page ID
            </NcMenuItem>
            <NcMenuItem
              v-if="isUIAllowed('docCreate')"
              @click="onDuplicatePage"
            >
              <GeneralIcon class="text-nc-content-gray-subtle" icon="duplicate" />
              Duplicate page
            </NcMenuItem>
            <NcDivider />
            <NcSubMenu key="download" variant="small">
              <template #title>
                <GeneralIcon class="text-nc-content-gray-subtle" icon="download" />
                Download as
              </template>
              <NcMenuItem @click="onDownloadMarkdown">
                Markdown
              </NcMenuItem>
              <NcMenuItem @click="onDownloadHTML">
                HTML
              </NcMenuItem>
              <NcMenuItem @click="onDownloadPDF">
                PDF
              </NcMenuItem>
            </NcSubMenu>
            <NcDivider />
            <NcMenuItem
              v-if="isUIAllowed('docDelete')"
              class="!text-red-500 !hover:bg-red-50"
              @click="onDeletePage"
            >
              <GeneralIcon icon="delete" />
              Delete page
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>

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
      <div class="nc-doc-editor-body pb-48 relative">
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

          <EditorContent :editor="editor" />

          <!-- Table context menus: column/row handles + dropdown menus -->
          <DocTableMenu :editor="editor" />
        </template>
      </div>
    </div>

    <!-- Delete page modal — matches table delete styling -->
    <GeneralDeleteModal
      v-model:visible="isDeleteModalOpen"
      entity-name="Page"
      :on-delete="confirmDeletePage"
    >
      <template #entity-preview>
        <div class="flex flex-row items-center py-2.25 px-2.5 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle">
          <GeneralIcon icon="ncFileText" class="text-nc-content-gray-subtle" />
          <div
            class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
          >
            {{ title || 'Untitled' }}
          </div>
        </div>
      </template>
    </GeneralDeleteModal>
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

// Page 3-dot context menu — pinned to top-right of full editor area
.nc-doc-page-menu {
  position: sticky;
  top: 0;
  align-self: flex-end;
  z-index: 20;
  padding: 12px 12px 0 0;
  // Collapse height so it doesn't push content down
  margin-bottom: -36px;
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

  // Headings — H1/H2/H3 prefix labels sit outside via absolute positioning.
  // Labels are bottom-aligned with the first line of heading text so they
  // sit on the same baseline regardless of heading font size.
  // Only visible when the editor is focused (ProseMirror-focused) — hidden
  // when the cursor is in the title input or elsewhere outside the editor.
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

  // Show H1/H2/H3 labels only when editor is focused
  &.ProseMirror-focused {
    h1::before { content: 'H1'; top: calc(1.625em * 1.3 - 12px - 2px); }
    h2::before { content: 'H2'; top: calc(1.3em * 1.35 - 12px - 2px); }
    h3::before { content: 'H3'; top: calc(1.125em * 1.4 - 12px - 2px); }
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
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fafafa;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    max-width: 320px;
    position: relative;

    &:hover {
      border-color: #d1d5db;
      background: #f5f5f5;

      .nc-file-attachment-delete {
        opacity: 1;
      }
    }

    &.nc-file-attachment-selected {
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px #3b82f6;
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
    color: #374151;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nc-file-attachment-size {
    font-size: 11px;
    color: #9ca3af;
    line-height: 1.3;
  }

  .nc-file-attachment-delete {
    flex-shrink: 0;
    opacity: 0;
    color: #9ca3af;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s, color 0.15s;

    &:hover {
      color: #ef4444;
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
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    background: #000;
    transition: border-color 0.15s, box-shadow 0.15s;

    &:hover {
      border-color: #d1d5db;

      .nc-embed-delete {
        opacity: 1;
      }
    }

    &.nc-embed-selected {
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px #3b82f6;
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
    padding-bottom: 56.25%; // 16:9 aspect ratio
  }

  .nc-embed-iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
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
      background: #eff6ff;
      border-left-color: #3b82f6;

      .nc-callout-icon {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='16' x2='12' y2='12'/%3E%3Cline x1='12' y1='8' x2='12.01' y2='8'/%3E%3C/svg%3E");
      }
    }

    &.nc-callout-warning {
      background: #fffbeb;
      border-left-color: #f59e0b;

      .nc-callout-icon {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='%23f59e0b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/%3E%3Cline x1='12' y1='9' x2='12' y2='13'/%3E%3Cline x1='12' y1='17' x2='12.01' y2='17'/%3E%3C/svg%3E");
      }
    }

    &.nc-callout-tip {
      background: #f0fdf4;
      border-left-color: #22c55e;

      .nc-callout-icon {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='%2322c55e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 20h10'/%3E%3Cpath d='M10 20c5.5-2.5.8-6.4 3-10'/%3E%3Cpath d='M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z'/%3E%3Cpath d='M14.1 6a7 7 0 0 0-1.1-3c1.9.5 3.3 1.6 4.4 3.1a12.3 12.3 0 0 1 2 5.6c-2-.8-3.5-1.8-4.5-3.2a9 9 0 0 1-.8-2.5z'/%3E%3C/svg%3E");
      }
    }

    &.nc-callout-important {
      background: #fef2f2;
      border-left-color: #ef4444;

      .nc-callout-icon {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='12'/%3E%3Cline x1='12' y1='16' x2='12.01' y2='16'/%3E%3C/svg%3E");
      }
    }
  }
}
</style>
