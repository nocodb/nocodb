<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
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
  } catch (e) {
    console.error('[doc:editor] save failed', e)
  } finally {
    isSaving.value = false
  }
}

const debouncedSave = () => {
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
  }
  saveTimeout.value = setTimeout(save, 2000)
}

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: 'Type \'/\' for commands, or start writing...' }),
    Image,
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
  ],
  editorProps: {
    attributes: {
      class: 'nc-doc-editor-content prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[200px]',
    },
  },
  onUpdate: () => {
    debouncedSave()
  },
})

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
  isLoaded.value = false
  const loaded = await loadDoc(id)

  if (loaded) {
    doc.value = loaded
    // Treat "Untitled" as empty — it's the server default, not a user-provided name
    title.value = loaded.title === 'Untitled' ? '' : (loaded.title || '')

    const parsed = parseContent(loaded.content)
    if (editor.value && parsed) {
      editor.value.commands.setContent(parsed)
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
  // Flush any pending save before the editor is destroyed
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
    save()
  }
  editor.value?.destroy()
})
</script>

<template>
  <div v-if="isLoaded && doc" class="nc-doc-editor flex flex-col h-full w-full overflow-y-auto">
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

      <!-- Editor -->
      <div class="nc-doc-editor-body pb-48">
        <EditorContent v-if="editor" :editor="editor" />
      </div>
    </div>
  </div>

  <div v-else class="flex items-center justify-center h-full">
    <GeneralLoader />
  </div>
</template>

<style lang="scss">
.nc-doc-editor {
  background: var(--nc-bg-default);
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

.nc-doc-editor-content {
  // Both classes sit on the same DOM element (Tiptap merges them)
  &.ProseMirror {
    min-height: 200px;

    > * + * {
      margin-top: 0.75em;
    }

    // Heading hierarchy — semibold, clear size steps
    // H1/H2/H3 prefix labels sit outside the content area via absolute positioning
    h1, h2, h3 {
      position: relative;

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
      font-size: 1.625em !important;
      font-weight: 600 !important;
      margin-top: 1.4em !important;
      margin-bottom: 0.4em !important;
      line-height: 1.3 !important;

      &::before { content: 'H1'; }
    }

    h2 {
      font-size: 1.3em !important;
      font-weight: 600 !important;
      margin-top: 1.2em !important;
      margin-bottom: 0.35em !important;
      line-height: 1.35 !important;

      &::before { content: 'H2'; }
    }

    h3 {
      font-size: 1.125em !important;
      font-weight: 600 !important;
      margin-top: 1em !important;
      margin-bottom: 0.3em !important;
      line-height: 1.4 !important;

      &::before { content: 'H3'; }
    }

    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      color: #d1d5db;
      pointer-events: none;
      height: 0;
    }

    // Tailwind Typography v1 renders bullets as ::before pseudo-elements
    // with background-color — override the default grey.
    ul > li::before {
      background-color: #1f2937 !important;
    }

    ol > li::before {
      color: #1f2937 !important;
    }

    // Tighter list spacing — prose wraps each li's text in a <p>
    ul li,
    ol li {
      margin-top: 0.1em !important;
      margin-bottom: 0.1em !important;
    }

    ul li p,
    ol li p {
      margin-top: 0 !important;
      margin-bottom: 0 !important;
    }

    table {
      border-collapse: collapse;
      margin: 0;
      overflow: hidden;
      table-layout: fixed;
      width: 100%;

      td,
      th {
        border: 1px solid var(--nc-border-gray-medium);
        box-sizing: border-box;
        min-width: 1em;
        padding: 6px 8px;
        position: relative;
        vertical-align: top;

        > * {
          margin-bottom: 0;
        }
      }

      th {
        background-color: var(--nc-bg-gray-light);
        font-weight: bold;
        text-align: left;
      }
    }
  }
}
</style>
