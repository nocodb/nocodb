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
import { DocDiffExtension, getDiffSteps, scrollToDiffChange, setDocDiffState } from './diffPlugin'
import { TaskItem } from '~/helpers/tiptap-markdown/extensions/nodes/task-item'
import { UserMention } from '~/helpers/tiptap-markdown/extensions/nodes/mention'

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

// `buildProxyUrl` is what turns a doc-image's stored FileReference id into
// a live, cookie-authenticated URL. The diff plugin reuses it to rewrite
// `<img src>` on deleted snapshots so the actual picture renders instead
// of the browser's broken-image fallback.
const { buildProxyUrl } = useDocumentImageUpload()

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
      resolveImageSrc: buildProxyUrl,
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
  // Count navigable steps, not individual decorations — a replace
  // (insert + delete at the same anchor) is one step, even though it
  // produces two decorations on screen.
  diffChangeCount.value = getDiffSteps(editor.value).length
  // Clamp the index — e.g. switching from a 5-change diff to a 2-change one
  // should put us back at index 0 instead of an out-of-range slot.
  if (currentChangeIndex.value >= diffChangeCount.value) {
    currentChangeIndex.value = 0
  }
  // Bring the focused change into view. The `currentChangeIndex` watcher
  // below handles user-driven nav, but here we also catch the modal-open
  // case where the index doesn't change (stays at 0) yet the changes only
  // just materialised.
  if (diffChangeCount.value > 0 && editor.value) {
    scrollToDiffChange(editor.value, currentChangeIndex.value)
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

// ── Mark-diff tooltip ────────────────────────────────────────────────
// Inline `format` decorations carry the human-readable diff (e.g. "Bold
// added") in a `data-nc-mark-diff` attribute. Delegated mouseover/mouseout
// on the viewer root turns that into a themed floating tooltip with no
// native-hover delay. position is computed from the hovered span's bounding
// rect — top-centred, 8px above, clamped to the viewport so a wide tooltip
// near the edges doesn't clip.
const viewerRoot = ref<HTMLElement | null>(null)
const tooltipText = ref('')
const tooltipX = ref(0)
const tooltipY = ref(0)
const tooltipVisible = ref(false)

function updateTooltipPosition(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  // Center over the hovered span, anchor 8px above its top. The CSS uses
  // translate(-50%, -100%) so (x, y) describes the bottom-center of the
  // tooltip — keeping the maths simple here.
  const margin = 8
  const minX = 12
  const maxX = window.innerWidth - 12
  const x = Math.min(maxX, Math.max(minX, rect.left + rect.width / 2))
  const y = Math.max(margin, rect.top - margin)
  tooltipX.value = x
  tooltipY.value = y
}

function onMouseOver(e: MouseEvent) {
  // PM stacks marks as nested spans (e.g. `<span.nc-doc-history-diff-format>
  // <strong>text</strong></span>`) so the mouseover fires with `e.target`
  // pointing at the innermost element. `closest` walks up the ancestors to
  // find the decoration span.
  const span = (e.target as HTMLElement | null)?.closest?.('.nc-doc-history-diff-format') as HTMLElement | null
  if (!span) {
    tooltipVisible.value = false
    return
  }
  const text = span.getAttribute('data-nc-mark-diff')
  if (!text) return
  tooltipText.value = text
  updateTooltipPosition(span)
  tooltipVisible.value = true
}

function onMouseLeaveRoot() {
  tooltipVisible.value = false
}

onMounted(() => {
  const root = viewerRoot.value
  if (!root) return
  root.addEventListener('mouseover', onMouseOver)
  // `mouseleave` doesn't bubble — needed in addition to mouseover so the
  // tooltip disappears when the cursor exits the viewer entirely (otherwise
  // it'd stick around because there's no final mouseover to clear it).
  root.addEventListener('mouseleave', onMouseLeaveRoot)
})

onBeforeUnmount(() => {
  const root = viewerRoot.value
  if (!root) return
  root.removeEventListener('mouseover', onMouseOver)
  root.removeEventListener('mouseleave', onMouseLeaveRoot)
})
</script>

<template>
  <div ref="viewerRoot" class="nc-doc-history-viewer">
    <EditorContent v-if="editor" :editor="editor" />
    <Teleport to="body">
      <div
        v-show="tooltipVisible"
        class="nc-doc-history-diff-tooltip"
        :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
        role="tooltip"
      >
        {{ tooltipText }}
      </div>
    </Teleport>
  </div>
</template>

<!--
  Two style blocks: an UN-SCOPED block imports the shared content partial
  (so its `.nc-doc-editor-content.ProseMirror` selectors match the editor
  root attribute we set above), and a SCOPED block holds viewer-only
  overrides — the diff-insert decoration colour and its dark-theme variant.
-->
<style lang="scss">
// `@use` loads the module at the top of the file; `@include` below emits
// the CSS. This is the Sass 3.0-safe replacement for `@import`.
@use '../_doc-content' as doc;
@include doc.doc-content;

// ── Mark-diff tooltip (teleported to body) ───────────────
// Mirrors NcTooltip's `dark` variant — gray-800 fill, white text, rounded
// corners, px-2 py-1 padding, drop shadow. `position: fixed` because we
// pass viewport coordinates; styles intentionally live in the UN-scoped
// block because the element is teleported to `document.body` and Vue's
// scoped CSS attribute does not reliably propagate through `<Teleport>`.
.nc-doc-history-diff-tooltip {
  @apply fixed px-2 py-1 rounded-lg bg-gray-800 text-white text-xs whitespace-nowrap pointer-events-none;
  // Above ant-design modals (1000) and tooltips (1070) so the floating
  // diff tooltip is never clipped by the history-panel modal it lives inside.
  z-index: 9999;
  transform: translate(-50%, -100%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
[theme='dark'] .nc-doc-history-diff-tooltip {
  @apply bg-[#3a3f4b];
}
</style>

<style lang="scss" scoped>
// All decoration / widget styling is nested under `:deep(...)` because
// `docDiffPlugin` mounts its decorations / DOM widgets at runtime inside
// the editor's PM content root, which Vue's scoped CSS otherwise can't
// reach with descendant selectors. `:deep()` un-scopes everything inside
// the parens so widget DOM matches.
.nc-doc-history-viewer :deep(.nc-doc-history-viewer-content) {
  // ── Insert highlight ─────────────────────────────────────
  .nc-doc-history-diff-insert {
    background-color: rgba(34, 197, 94, 0.18);
    border-radius: 2px;
    transition: background-color 0.15s ease;
  }
  .nc-doc-history-diff-insert-current {
    background-color: rgba(34, 197, 94, 0.45);
  }

  // ── Format-change highlight ──────────────────────────────
  // Text whose marks changed (bold/italic/strike/code/link/etc.) but whose
  // content stayed identical between revisions. Amber wash so it reads as
  // distinct from green-insert ("new text") and red-delete ("removed text").
  .nc-doc-history-diff-format {
    background-color: rgba(245, 158, 11, 0.18);
    border-radius: 2px;
    transition: background-color 0.15s ease;
  }
  .nc-doc-history-diff-format-current {
    background-color: rgba(245, 158, 11, 0.45);
  }

  // Atom-leaf insert (images, embeds, file attachments) — the inline
  // highlight above doesn't wrap leaf-node DOM, so a node-level decoration
  // tags the NodeView wrapper. Each wrapper spans the full alignment box
  // (whole content width), which would draw the outline as a wide rectangle
  // far past the actual media — we instead target the inner "card" element
  // each NodeView renders so the frame hugs the content at its configured
  // size. Same selector list for the focused-step variant.
  .nc-doc-history-diff-insert-atom .nc-doc-image,
  .nc-doc-history-diff-insert-atom .nc-embed-card,
  .nc-doc-history-diff-insert-atom .nc-file-attachment-card {
    outline: 2px solid rgba(34, 197, 94, 0.5);
    outline-offset: 2px;
    border-radius: 4px;
    transition: outline-color 0.15s ease;
  }
  .nc-doc-history-diff-insert-atom-current .nc-doc-image,
  .nc-doc-history-diff-insert-atom-current .nc-embed-card,
  .nc-doc-history-diff-insert-atom-current .nc-file-attachment-card {
    outline-color: rgba(34, 197, 94, 0.85);
  }

  // Inserted divider — `_doc-content.scss` draws the visible line via an
  // `::after` pseudo-element (the host `<hr>` has `border: none`), so the
  // green treatment lives on the pseudo. A wash on the host mirrors the
  // red-deletion style so insert / delete read symmetrically and the
  // divider stands out as much as inserted text.
  hr.nc-doc-history-diff-insert-atom {
    background-color: rgba(34, 197, 94, 0.12);
  }
  hr.nc-doc-history-diff-insert-atom::after {
    border-top-color: rgba(34, 197, 94, 0.7) !important;
    border-top-width: 2px !important;
    transition: border-top-color 0.15s ease;
  }
  hr.nc-doc-history-diff-insert-atom-current {
    background-color: rgba(34, 197, 94, 0.28);
  }
  hr.nc-doc-history-diff-insert-atom-current::after {
    border-top-color: rgba(34, 197, 94, 0.95) !important;
  }

  // ── Inline-strike delete (within a single block) ─────────
  // Muted-grey text + grey strikethrough on a very light red wash —
  // matches the completed-task style in `_doc-content.scss`.
  .nc-doc-history-diff-delete {
    background-color: rgba(239, 68, 68, 0.08);
    color: var(--nc-content-gray-muted);
    text-decoration: line-through;
    text-decoration-color: var(--nc-content-gray-disabled);
    border-radius: 2px;
    padding: 0 2px;
    transition: background-color 0.15s ease;
  }
  .nc-doc-history-diff-delete-current {
    background-color: rgba(239, 68, 68, 0.22);
  }

  // ── Cross-block delete ───────────────────────────────────
  // The wrapper is a passthrough — block chrome (quote bar, code-block
  // background, callout body, list markers, ...) renders untouched, exactly
  // like the surrounding doc. Text leaves inside the wrapper carry the
  // `.nc-doc-history-diff-delete` class (injected at render time) and pick
  // up the same red-wash + grey-strike treatment used for inline deletions.
  .nc-doc-history-deleted-block {
    user-select: text;
  }

  // Deleted atom-leaf nodes (images, embeds, file attachments) get a red
  // outline so deletion is unambiguous. Each renders its native card via
  // the partial styles in `_doc-content.scss`: images use a rewritten src,
  // embeds rebuild the `.nc-embed-card` iframe DOM, file attachments
  // rebuild the `.nc-file-attachment-card` badge + name + size structure.
  .nc-doc-history-diff-delete-atom .nc-doc-image,
  .nc-doc-history-diff-delete-atom .nc-embed-card,
  .nc-doc-history-diff-delete-atom .nc-file-attachment-card {
    outline: 2px solid rgba(239, 68, 68, 0.5);
    outline-offset: 2px;
    border-radius: 4px;
    transition: outline-color 0.15s ease;
  }
  .nc-doc-history-diff-delete-atom-current .nc-doc-image,
  .nc-doc-history-diff-delete-atom-current .nc-embed-card,
  .nc-doc-history-diff-delete-atom-current .nc-file-attachment-card {
    outline-color: rgba(239, 68, 68, 0.85);
  }

  // Deleted divider — same `::after` indirection as the inserted variant.
  // Faint red wash on the host shows the removed separator inside the
  // cross-block deletion wrapper.
  hr.nc-doc-history-diff-delete-atom {
    background-color: rgba(239, 68, 68, 0.08);
  }
  hr.nc-doc-history-diff-delete-atom::after {
    border-top-color: rgba(239, 68, 68, 0.65) !important;
    border-top-width: 2px !important;
    transition: border-top-color 0.15s ease;
  }
  hr.nc-doc-history-diff-delete-atom-current {
    background-color: rgba(239, 68, 68, 0.22);
  }
  hr.nc-doc-history-diff-delete-atom-current::after {
    border-top-color: rgba(239, 68, 68, 0.95) !important;
  }
}

// ── Dark theme overrides ─────────────────────────────────
[theme='dark'] .nc-doc-history-viewer :deep(.nc-doc-history-viewer-content) {
  .nc-doc-history-diff-insert {
    background-color: rgba(34, 197, 94, 0.28);
  }
  .nc-doc-history-diff-insert-current {
    background-color: rgba(34, 197, 94, 0.6);
  }
  .nc-doc-history-diff-format {
    background-color: rgba(245, 158, 11, 0.28);
  }
  .nc-doc-history-diff-format-current {
    background-color: rgba(245, 158, 11, 0.6);
  }
  .nc-doc-history-diff-delete {
    background-color: rgba(239, 68, 68, 0.14);
  }
  .nc-doc-history-diff-delete-current {
    background-color: rgba(239, 68, 68, 0.3);
  }
}
</style>
