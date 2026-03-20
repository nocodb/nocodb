<script setup lang="ts">
import type { Node as PmNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps<Props>()

const MAX_TABS = 10

interface Props {
  node: PmNode
  editor: Editor
  getPos: () => number
}

const { $e } = useNuxtApp()

const isEditable = computed(() => props.editor.isEditable)

// Local UI state — not persisted in the document model.
const activeTab = ref(0)

// Clamp activeTab when tab count changes (e.g. after delete or collab sync)
watch(
  () => props.node.childCount,
  (count) => {
    if (activeTab.value >= count) {
      activeTab.value = Math.max(0, count - 1)
    }
  },
)

const tabs = computed(() => {
  const result: { title: string }[] = []
  props.node.content.forEach((child) => {
    result.push({ title: child.attrs?.title || 'Tab' })
  })
  return result
})

/** Get the document position of the nth docTab child node. */
function getTabPos(index: number): number | null {
  const pos = props.getPos()
  if (typeof pos !== 'number') return null

  let offset = pos + 1 // skip docTabs opening
  for (let i = 0; i < index; i++) {
    offset += props.node.child(i).nodeSize
  }
  return offset
}

/** Select the entire docTabs node so Backspace/Delete removes it. */
function selectBlock() {
  const pos = props.getPos()
  if (typeof pos !== 'number') return

  const { state } = props.editor
  const nodeSelection = NodeSelection.create(state.doc, pos)
  props.editor.view.dispatch(state.tr.setSelection(nodeSelection))
  props.editor.view.focus()
}

/** Click on non-editable chrome (header empty space, padding) → select whole block. */
function onChromeClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('.nc-doc-tab-btn, .nc-doc-tab-rename-input, .nc-doc-tab-add-btn')) return
  if (isEditable.value) selectBlock()
}

const isMenuOpen = ref(false)
const menuTabIndex = ref(0)

function onTabClick(index: number) {
  if (index !== activeTab.value) {
    switchTab(index)
    return
  }
  // Already active → show dropdown (only in edit mode)
  if (!isEditable.value) return
  menuTabIndex.value = index
  isMenuOpen.value = true
}

function switchTab(index: number) {
  if (index === activeTab.value) return

  $e('c:doc:tab:switch')
  activeTab.value = index

  if (!isEditable.value) return

  nextTick(() => {
    const tabPos = getTabPos(index)
    if (tabPos === null) return

    // +1 to enter the docTab, +1 to enter its first child block
    const targetPos = tabPos + 2

    const { state } = props.editor
    if (targetPos > 0 && targetPos < state.doc.content.size) {
      const resolvedPos = state.doc.resolve(targetPos)
      const selection = TextSelection.near(resolvedPos)
      props.editor.view.dispatch(state.tr.setSelection(selection))
      props.editor.view.focus()
    }
  })
}

// --- Dropdown menu ---
function onMenuRename() {
  isMenuOpen.value = false
  startRename(menuTabIndex.value)
}

function onMenuDelete() {
  $e('c:doc:tab:delete')
  isMenuOpen.value = false

  const index = menuTabIndex.value
  const tabCount = props.node.childCount

  // Last tab → delete entire tabs block
  if (tabCount <= 1) {
    const pos = props.getPos()
    if (typeof pos !== 'number') return

    const { tr } = props.editor.state
    tr.delete(pos, pos + props.node.nodeSize)
    props.editor.view.dispatch(tr)
    return
  }

  const tabPos = getTabPos(index)
  if (tabPos === null) return

  const tabEnd = tabPos + props.node.child(index).nodeSize

  const { tr } = props.editor.state
  tr.delete(tabPos, tabEnd)
  props.editor.view.dispatch(tr)

  // Adjust activeTab index
  if (activeTab.value >= tabCount - 1) {
    activeTab.value = tabCount - 2
  } else if (activeTab.value > index) {
    activeTab.value = activeTab.value - 1
  }
}

// --- Tab rename ---

const editingTabIndex = ref<number | null>(null)
const editingTitle = ref('')

function startRename(index: number) {
  editingTabIndex.value = index
  editingTitle.value = tabs.value[index]?.title || ''
}

function commitRename() {
  const index = editingTabIndex.value
  if (index === null) return

  const title = editingTitle.value.trim() || `Tab ${index + 1}`
  editingTabIndex.value = null

  const tabPos = getTabPos(index)
  if (tabPos === null) return

  const tabNode = props.node.child(index)
  if (tabNode.attrs.title === title) return

  const { tr } = props.editor.state
  tr.setNodeMarkup(tabPos, undefined, { ...tabNode.attrs, title })
  props.editor.view.dispatch(tr)

  $e('c:doc:tab:rename')
}

function cancelRename() {
  editingTabIndex.value = null
}

function onRenameKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitRename()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelRename()
  }
}

// --- Drag reorder (manual mouse tracking — no HTML5 drag ghost) ---

const dragSourceIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const headerRef = ref<HTMLElement | null>(null)

/** Resolve which tab button the X coordinate falls on */
function getTabIndexAtX(clientX: number): number | null {
  if (!headerRef.value) return null
  const buttons = headerRef.value.querySelectorAll('.nc-doc-tab-btn')
  for (let i = 0; i < buttons.length; i++) {
    const rect = buttons[i].getBoundingClientRect()
    if (clientX >= rect.left && clientX <= rect.right) return i
  }
  return null
}

function onTabMousedown(event: MouseEvent, index: number) {
  if (!isEditable.value) return
  if (event.button !== 0 || editingTabIndex.value !== null) return

  const startX = event.clientX
  const startY = event.clientY
  let isDragging = false

  const onMousemove = (e: MouseEvent) => {
    if (!isDragging) {
      // Start drag only after 4px horizontal movement
      const dx = Math.abs(e.clientX - startX)
      const dy = Math.abs(e.clientY - startY)
      if (dx < 4 && dy < 4) return
      if (dy > dx) {
        cleanup()
        return
      } // more vertical than horizontal — cancel
      isDragging = true
      dragSourceIndex.value = index
    }
    const target = getTabIndexAtX(e.clientX)
    dragOverIndex.value = target !== null && target !== dragSourceIndex.value ? target : null
  }

  const onMouseup = (e: MouseEvent) => {
    const wasDragging = isDragging
    const sourceIdx = dragSourceIndex.value
    const targetIdx = getTabIndexAtX(e.clientX)

    cleanup()

    if (!wasDragging || sourceIdx === null) return
    if (targetIdx === null || sourceIdx === targetIdx) return
    reorderTab(sourceIdx, targetIdx)
    $e('c:doc:tab:reorder')
  }

  function cleanup() {
    document.removeEventListener('mousemove', onMousemove)
    document.removeEventListener('mouseup', onMouseup)
    if (!isDragging) return
    dragSourceIndex.value = null
    dragOverIndex.value = null
  }

  document.addEventListener('mousemove', onMousemove)
  document.addEventListener('mouseup', onMouseup)
}

function reorderTab(sourceIndex: number, targetIndex: number) {
  const pos = props.getPos()
  if (typeof pos !== 'number') return

  // Compute the new activeTab index before the transaction
  let newActiveTab = activeTab.value
  if (newActiveTab === sourceIndex) {
    newActiveTab = targetIndex
  } else if (sourceIndex < targetIndex) {
    if (newActiveTab > sourceIndex && newActiveTab <= targetIndex) newActiveTab--
  } else {
    if (newActiveTab >= targetIndex && newActiveTab < sourceIndex) newActiveTab++
  }

  const json = props.node.toJSON()
  const [moved] = json.content.splice(sourceIndex, 1)
  json.content.splice(targetIndex, 0, moved)

  const newNode = ProseMirrorNode.fromJSON(props.editor.schema, json)
  const { tr } = props.editor.state
  tr.replaceWith(pos, pos + props.node.nodeSize, newNode)
  props.editor.view.dispatch(tr)

  // Set activeTab after dispatch — NodeView may be recreated by replaceWith,
  // but if it survives, this keeps it in sync
  activeTab.value = newActiveTab
}

// --- Add tab ---

function addTab() {
  if (props.node.childCount >= MAX_TABS) return

  const pos = props.getPos()
  if (typeof pos !== 'number') return

  const newIndex = props.node.childCount
  const title = `Tab ${newIndex + 1}`

  // Insert at the end of the docTabs node (before its closing)
  const insertPos = pos + props.node.nodeSize - 1

  const tabNodeType = props.editor.schema.nodes.docTab
  const paraNodeType = props.editor.schema.nodes.paragraph
  const newTab = tabNodeType.create({ title }, paraNodeType.create())

  const { tr } = props.editor.state
  tr.insert(insertPos, newTab)
  props.editor.view.dispatch(tr)

  $e('c:doc:tab:add')

  // Switch to the new tab
  nextTick(() => {
    activeTab.value = newIndex
  })
}
</script>

<template>
  <NodeViewWrapper class="nc-doc-tabs" data-doc-tabs data-testid="nc-doc-tabs">
    <!-- Tab header bar -->
    <div
      ref="headerRef"
      class="nc-doc-tabs-header"
      role="tablist"
      contenteditable="false"
      data-testid="nc-doc-tabs-header"
      @click="onChromeClick"
    >
      <template v-for="(tab, index) in tabs" :key="tab.title + index">
        <!-- Rename input -->
        <input
          v-if="isEditable && editingTabIndex === index"
          v-model="editingTitle"
          class="nc-doc-tab-rename-input"
          :data-testid="`nc-doc-tab-rename-${index}`"
          maxlength="50"
          @blur="commitRename"
          @keydown="onRenameKeydown"
          @vue:mounted="({ el }: { el: HTMLInputElement }) => el.focus()"
        />

        <!-- Tab button with dropdown for active tab -->
        <NcDropdown
          v-else
          :visible="isEditable && isMenuOpen && menuTabIndex === index"
          placement="bottomLeft"
          @update:visible="(v: boolean) => { if (!v) isMenuOpen = false }"
        >
          <button
            class="nc-doc-tab-btn"
            :class="{
              'active': index === activeTab,
              'nc-drag-source': dragSourceIndex === index,
              'nc-drag-over': dragOverIndex === index && dragSourceIndex !== index,
            }"
            role="tab"
            :aria-selected="index === activeTab"
            :data-testid="`nc-doc-tab-btn-${index}`"
            @click.stop="onTabClick(index)"
            @mousedown="onTabMousedown($event, index)"
          >
            {{ tab.title }}
          </button>

          <template #overlay>
            <div class="nc-slash-menu" style="min-width: 140px" data-testid="nc-doc-tab-menu">
              <div class="nc-slash-menu-item" data-testid="nc-doc-tab-menu-rename" @click="onMenuRename">
                <span class="nc-slash-menu-icon">
                  <GeneralIcon icon="rename" />
                </span>
                <span class="nc-slash-menu-label">{{ $t('general.rename') }}</span>
              </div>
              <div class="nc-slash-menu-item" data-testid="nc-doc-tab-menu-delete" @click="onMenuDelete">
                <span class="nc-slash-menu-icon nc-doc-tab-menu-delete-icon">
                  <GeneralIcon icon="delete" />
                </span>
                <span class="nc-slash-menu-label nc-doc-tab-menu-delete-label">{{ $t('general.delete') }}</span>
              </div>
            </div>
          </template>
        </NcDropdown>
      </template>

      <!-- Add tab button (edit mode only, up to MAX_TABS) -->
      <button
        v-if="isEditable && tabs.length < MAX_TABS"
        class="nc-doc-tab-add-btn"
        data-testid="nc-doc-tab-add"
        @click.stop="addTab"
      >
        <GeneralIcon icon="plus" />
      </button>
    </div>

    <!-- Tab content panes -->
    <NodeViewContent class="nc-doc-tabs-content" :data-active-tab="activeTab" role="tabpanel" data-testid="nc-doc-tabs-content" />
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.nc-doc-tabs {
  @apply border-1 border-nc-border-gray-medium rounded-lg my-3;
}

.nc-doc-tabs-header {
  @apply flex gap-1 px-3 pt-2 pb-0 overflow-x-auto;
  flex-wrap: nowrap;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.nc-doc-tab-btn {
  @apply px-3 py-1 mb-1.5 text-bodySm cursor-pointer rounded-md transition-colors whitespace-nowrap;
  @apply text-nc-content-gray-muted bg-transparent border-0 flex-shrink-0;

  &.active {
    @apply text-nc-content-gray bg-nc-bg-gray-light font-semibold;
  }

  &:hover:not(.active) {
    @apply bg-nc-bg-gray-light bg-opacity-50;
  }

  &.nc-drag-source {
    @apply opacity-40;
  }

  &.nc-drag-over {
    box-shadow: -2px 0 0 0 var(--nc-border-brand);
  }
}

.nc-doc-tab-add-btn {
  @apply flex items-center justify-center w-6 h-6 mb-1.5 cursor-pointer rounded-md transition-colors;
  @apply text-nc-content-gray-muted bg-transparent border-0 opacity-0;

  .nc-doc-tabs-header:hover & {
    @apply opacity-100;
  }

  &:hover {
    @apply bg-nc-bg-gray-light text-nc-content-gray;
  }
}

.nc-doc-tab-rename-input {
  @apply px-3 py-1 mb-1.5 text-bodySm rounded-md;
  @apply text-nc-content-gray bg-white border-1 border-nc-border-brand;
  @apply outline-none;
  width: 120px;
}

.nc-doc-tab-menu-delete-icon,
.nc-doc-tab-menu-delete-label {
  @apply !text-nc-content-red-dark;
}

.nc-doc-tabs-content {
  @apply relative py-3 px-3 min-h-16;

  :deep([data-doc-tab]) {
    position: absolute;
    left: 0;
    right: 0;
    opacity: 0;
    height: 0;
    overflow: hidden;
    pointer-events: none;
  }

  &[data-active-tab='0'] :deep([data-doc-tab]:nth-child(1)),
  &[data-active-tab='1'] :deep([data-doc-tab]:nth-child(2)),
  &[data-active-tab='2'] :deep([data-doc-tab]:nth-child(3)),
  &[data-active-tab='3'] :deep([data-doc-tab]:nth-child(4)),
  &[data-active-tab='4'] :deep([data-doc-tab]:nth-child(5)),
  &[data-active-tab='5'] :deep([data-doc-tab]:nth-child(6)),
  &[data-active-tab='6'] :deep([data-doc-tab]:nth-child(7)),
  &[data-active-tab='7'] :deep([data-doc-tab]:nth-child(8)),
  &[data-active-tab='8'] :deep([data-doc-tab]:nth-child(9)),
  &[data-active-tab='9'] :deep([data-doc-tab]:nth-child(10)) {
    position: relative;
    opacity: 1;
    height: auto;
    overflow: visible;
    pointer-events: auto;
  }
}
</style>

<!-- Unscoped: ProseMirror adds .ProseMirror-selectednode directly on the DOM -->
<style lang="scss">
.nc-doc-tabs.ProseMirror-selectednode {
  border-color: var(--nc-border-brand) !important;
  background-color: var(--nc-bg-brand);
  outline: none;

  // Suppress all text selection highlights inside the block
  *::selection {
    background: transparent !important;
  }

  // Also suppress any ProseMirror selection-related styling
  .ProseMirror-gapcursor,
  .ProseMirror-selectednode {
    display: none;
  }
}
</style>
