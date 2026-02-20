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

const props = defineProps<{
  docId: string
}>()

const docId = toRef(props, 'docId')

const docsStore = useDocsStore()
const { loadDoc, updateDoc } = docsStore

const basesStore = useBases()
const { activeProjectId } = storeToRefs(basesStore)

const doc = ref<DocType | null>(null)
const title = ref('')
const isSaving = ref(false)
const isLoaded = ref(false)

// Debounced save
const saveTimeout = ref<NodeJS.Timeout>()

const save = async () => {
  if (!doc.value || !activeProjectId.value || !editor.value) return

  isSaving.value = true
  try {
    const content = editor.value.getJSON()
    const updated = await updateDoc(activeProjectId.value, doc.value.id!, {
      title: title.value,
      content,
      version: doc.value.version,
    })

    if (updated) {
      doc.value.version = updated.version
    }
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
    Placeholder.configure({ placeholder: 'Start writing...' }),
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

const loadAndSetDoc = async (id: string) => {
  isLoaded.value = false
  const loaded = await loadDoc(id)

  if (loaded) {
    doc.value = loaded
    title.value = loaded.title || ''

    if (editor.value && loaded.content) {
      editor.value.commands.setContent(loaded.content)
    }
  }
  isLoaded.value = true
}

// Watch for docId changes
watch(
  docId,
  async (newId) => {
    if (newId) {
      await loadAndSetDoc(newId)
    }
  },
  { immediate: true },
)

// Save title on blur
const onTitleBlur = () => {
  if (title.value !== doc.value?.title) {
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
  // Flush any pending save
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
    save()
  }
  editor.value?.destroy()
})
</script>

<template>
  <div v-if="isLoaded && doc" class="nc-doc-editor flex flex-col h-full w-full">
    <!-- Title -->
    <div class="nc-doc-editor-header px-12 pt-12 pb-4">
      <input
        v-model="title"
        class="nc-doc-title w-full text-3xl font-bold outline-none bg-transparent placeholder-nc-content-gray-muted"
        placeholder="Untitled"
        @blur="onTitleBlur"
        @keydown="onTitleKeydown"
      />
      <div v-if="isSaving" class="text-xs text-nc-content-gray-muted mt-1">Saving...</div>
    </div>

    <!-- Editor -->
    <div class="nc-doc-editor-body flex-1 overflow-y-auto px-12 pb-24">
      <EditorContent v-if="editor" :editor="editor" />
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

.nc-doc-editor-content {
  .ProseMirror {
    min-height: 200px;

    > * + * {
      margin-top: 0.75em;
    }

    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      color: var(--nc-content-gray-muted);
      pointer-events: none;
      height: 0;
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
