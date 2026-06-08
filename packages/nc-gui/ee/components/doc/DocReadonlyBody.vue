<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TableRow from '@tiptap/extension-table-row'
import { DocHighlightExtension } from './DocHighlightExtension'
import { DocTextColorExtension } from './DocTextColorExtension'
import { DocCommentMarkExtension } from './DocCommentMarkExtension'
import { DocImageExtension } from './DocImageExtension'
import { DocFileAttachmentExtension } from './DocFileAttachmentExtension'
import { DocEmbedExtension } from './DocEmbedExtension'
import { DocCodeBlockExtension } from './DocCodeBlockExtension'
import { DocTable, DocTableCell, DocTableHeader } from './DocTableExtensions'
import { CalloutExtension } from './CalloutExtension'
import { DocColumnExtension, DocColumnsExtension } from './DocColumnsExtension'
import { DocTabExtension, DocTabsExtension } from './DocTabsExtension'
import { DocMathExtension } from './DocMathExtension'
import { DocBlockDirExtension } from './DocBlockDirPlugin'
import { TaskItem } from '~/helpers/tiptap-markdown/extensions/nodes/task-item'
import { UserMention } from '~/helpers/tiptap-markdown/extensions/nodes/mention'

const props = defineProps<{ content?: Record<string, any> | null }>()

// Read-only render of legacy content for non-seeder viewers (see Editor.vue
// showLegacyFallback). Never writes to the shared Y.Doc.
const editor = useEditor({
  editable: false,
  content: parseDocContent(props.content),
  extensions: [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
    DocCodeBlockExtension,
    Underline,
    DocHighlightExtension,
    DocTextColorExtension,
    DocCommentMarkExtension,
    Link.configure({ openOnClick: false }),
    DocImageExtension,
    TaskList,
    TaskItem.configure({ nested: true }),
    DocTable.configure({ resizable: false }),
    TableRow,
    DocTableCell,
    DocTableHeader,
    // Node schema so legacy @mentions render (suggestion popup is inert in
    // editable:false, so bare config is fine).
    UserMention,
    CalloutExtension,
    DocColumnsExtension,
    DocColumnExtension,
    DocTabsExtension,
    DocTabExtension,
    DocMathExtension,
    DocFileAttachmentExtension,
    DocEmbedExtension,
    // Per-block dir="auto" decoration — needed for RTL/LTR render parity.
    DocBlockDirExtension,
  ],
})

// Re-render if the loaded content arrives/changes after mount.
watch(
  () => props.content,
  (next) => {
    if (editor.value) editor.value.commands.setContent(parseDocContent(next))
  },
)
</script>

<template>
  <div class="nc-doc-readonly-body relative">
    <EditorContent v-if="editor" :editor="editor" class="nc-doc-editor-content" />
  </div>
</template>
