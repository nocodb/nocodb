<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TableRow from '@tiptap/extension-table-row'
import { DocHighlightExtension } from '../DocHighlightExtension'
import { DocTextColorExtension } from '../DocTextColorExtension'
import { DocCommentMarkExtension } from '../DocCommentMarkExtension'
import { DocImageExtension } from '../DocImageExtension'
import { DocFileAttachmentExtension } from '../DocFileAttachmentExtension'
import { DocEmbedExtension } from '../DocEmbedExtension'
import { DocCodeBlockExtension } from '../DocCodeBlockExtension'
import { DocTable, DocTableCell, DocTableHeader } from '../DocTableExtensions'
import { CalloutExtension } from '../CalloutExtension'
import { DocColumnExtension, DocColumnsExtension } from '../DocColumnsExtension'
import { DocTabExtension, DocTabsExtension } from '../DocTabsExtension'
import { DocMathExtension } from '../DocMathExtension'
import { DocBlockDirExtension } from '../DocBlockDirPlugin'
import { TaskItem } from '~/helpers/tiptap-markdown/extensions/nodes/task-item'
import { UserMention } from '~/helpers/tiptap-markdown/extensions/nodes/mention'
import { DocDiffExtension, getDiffChanges, scrollToDiffChange, setDocDiffState } from './diffPlugin'

interface Props {
  content: Record<string, any> | null
  /**
   * The "from" side of the diff — typically the previous revision's content
   * (default) or the current doc's content (when "Compare to current" is
   * picked). When null/undefined, no diff highlighting is applied.
   */
  comparisonContent?: Record<string, any> | null
  /** Whether to render diff decorations. Bound to the "Highlight changes" toggle. */
  highlightChanges?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  comparisonContent: null,
  highlightChanges: true,
})

// Curated read-only extension list — rendering parity with the live doc
// editor, minus all interactive extensions (slash command, drag handle,
// search, AI, active block, heading collapse/anchor, columns toolbar,
// placeholder). The viewer never enters edit mode, so omitting them
// keeps the bundle and lifecycle work small.
const viewerExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: false,
  }),
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
  // UserMention with no suggestion config — display-only.
  UserMention,
  CalloutExtension,
  DocColumnsExtension,
  DocColumnExtension,
  DocTabsExtension,
  DocTabExtension,
  DocMathExtension,
  DocFileAttachmentExtension,
  DocEmbedExtension,
  DocBlockDirExtension,
  DocDiffExtension.configure({
    initialState: {
      fromContent: props.comparisonContent,
      toContent: props.content,
      enabled: !!props.highlightChanges,
      currentIndex: 0,
    },
  }),
]

const editor = useEditor({
  editable: false,
  extensions: viewerExtensions,
  editorProps: {
    attributes: {
      // `nc-doc-editor-content` is intentional — it's the root class the
      // shared content partial (`_doc-content.scss`) targets. Mirroring
      // the live editor's class means tables, callouts, math, attachments
      // etc. all render identically here without further work. The
      // `nc-doc-history-viewer-content` class is added for history-specific
      // overrides (e.g. the diff-insert decoration colour).
      class: 'nc-doc-editor-content nc-doc-history-viewer-content focus:outline-none',
    },
  },
  content: props.content || { type: 'doc', content: [{ type: 'paragraph' }] },
})

const { diffChangeCount, currentChangeIndex } = useDocRevisions()

// Push the diff plugin's cached change-count up to the composable after every
// state update so the modal header's "N changes" + ↑/↓ buttons stay in sync.
// `nextTick` lets the plugin's `apply()` run before we read its state.
async function syncChangeCount() {
  await nextTick()
  diffChangeCount.value = getDiffChanges(editor.value).length
  // Clamp the index — e.g. switching from a 5-change diff to a 2-change one
  // should put us back at index 0 instead of an out-of-range slot.
  if (currentChangeIndex.value >= diffChangeCount.value) {
    currentChangeIndex.value = 0
  }
}

// Replace content when the previewed revision changes. We push the new doc
// JSON into the diff state too so the comparison stays in sync — `setContent`
// also fires a `docChanged` transaction, but we override it here for clarity.
watch(
  () => props.content,
  (next) => {
    if (!editor.value) return
    const nextDoc = next || { type: 'doc', content: [{ type: 'paragraph' }] }
    editor.value.commands.setContent(nextDoc, false)
    setDocDiffState(editor.value, { toContent: nextDoc })
    syncChangeCount()
  },
)

// Push comparison / toggle updates to the diff plugin without re-creating
// the editor — keeps scroll position and avoids a full re-render.
watch(
  () => [props.comparisonContent, props.highlightChanges] as const,
  ([from, enabled]) => {
    setDocDiffState(editor.value, {
      fromContent: from ?? null,
      enabled: !!enabled,
    })
    syncChangeCount()
  },
)

// Initial sync once the editor mounts (the first diff was computed in
// `state.init`, but the composable hasn't been told about it yet).
onMounted(() => {
  syncChangeCount()
})

// Push the focused-change index into the plugin so the corresponding
// decoration picks up the "current" class — then scroll. Order matters:
// updating the meta first ensures the decoration is repainted before
// the smooth-scroll animation begins.
watch(currentChangeIndex, (index) => {
  if (!editor.value) return
  setDocDiffState(editor.value, { currentIndex: index })
  scrollToDiffChange(editor.value, index)
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div class="nc-doc-history-viewer">
    <EditorContent v-if="editor" :editor="editor" />
  </div>
</template>

<!--
  Two style blocks: an UN-SCOPED block imports the shared content partial
  (so its `.nc-doc-editor-content.ProseMirror` selectors match the editor
  root attribute we set above), and a SCOPED block holds viewer-only
  overrides — the diff-insert decoration colour and its dark-theme variant.
-->
<style lang="scss">
@import '../_doc-content';
</style>

<style lang="scss" scoped>
.nc-doc-history-viewer :deep(.nc-doc-history-viewer-content) {
  // Inserted text highlight. The class is applied as an inline decoration
  // by `docDiffPlugin` to every range that's new in the previewed revision
  // compared to the comparison basis.
  .nc-doc-history-diff-insert {
    background-color: rgba(34, 197, 94, 0.18);
    border-radius: 2px;
    box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.32);
    transition: background-color 0.15s ease, box-shadow 0.15s ease;
  }

  // The change currently focused by the step-through nav — more saturated
  // background + a thicker ring so it pops above the rest.
  .nc-doc-history-diff-insert-current {
    background-color: rgba(34, 197, 94, 0.4);
    box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.85);
  }
}

[theme='dark'] .nc-doc-history-viewer :deep(.nc-doc-history-viewer-content) {
  .nc-doc-history-diff-insert {
    background-color: rgba(34, 197, 94, 0.28);
    box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.5);
  }
  .nc-doc-history-diff-insert-current {
    background-color: rgba(34, 197, 94, 0.55);
    box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.9);
  }
}
</style>
