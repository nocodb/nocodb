<script setup lang="ts">
import type { Node as PmNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/vue-3'

interface Props {
  node: PmNode
  editor: Editor
  getPos: () => number
}

const props = defineProps<Props>()

// Local UI state — not persisted in the document model.
const activeTab = ref(0)

const tabs = computed(() => {
  const result: { title: string }[] = []
  props.node.content.forEach((child) => {
    result.push({ title: child.attrs?.title || 'Tab' })
  })
  return result
})

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
  if ((event.target as HTMLElement).closest('.nc-doc-tab-btn, .nc-doc-tab-rename-input')) return
  selectBlock()
}

function onTabClick(index: number) {
  if (index !== activeTab.value) {
    // Inactive tab → activate it, no dropdown
    switchTab(index)
    return
  }
  // Already active → show dropdown
  menuTabIndex.value = index
  isMenuOpen.value = true
}

function switchTab(index: number) {
  if (index === activeTab.value) return

  activeTab.value = index

  nextTick(() => {
    const pos = props.getPos()
    if (typeof pos !== 'number') return

    let offset = pos + 1
    for (let i = 0; i < index; i++) {
      offset += props.node.child(i).nodeSize
    }
    const targetPos = offset + 2

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

const isMenuOpen = ref(false)
const menuTabIndex = ref(0)

function onMenuRename() {
  isMenuOpen.value = false
  startRename(menuTabIndex.value)
}

function onMenuDelete() {
  isMenuOpen.value = false

  const index = menuTabIndex.value
  const tabCount = props.node.childCount

  // Last tab → delete entire tabs block
  if (tabCount <= 1) {
    selectBlock()
    nextTick(() => {
      props.editor.commands.deleteSelection()
    })
    return
  }

  const pos = props.getPos()
  if (typeof pos !== 'number') return

  // Find position of the target docTab
  let tabPos = pos + 1
  for (let i = 0; i < index; i++) {
    tabPos += props.node.child(i).nodeSize
  }
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

  const pos = props.getPos()
  if (typeof pos !== 'number') return

  let tabPos = pos + 1
  for (let i = 0; i < index; i++) {
    tabPos += props.node.child(i).nodeSize
  }

  const tabNode = props.node.child(index)
  if (tabNode.attrs.title === title) return

  const { tr } = props.editor.state
  tr.setNodeMarkup(tabPos, undefined, { ...tabNode.attrs, title })
  props.editor.view.dispatch(tr)
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
</script>

<template>
  <NodeViewWrapper class="nc-doc-tabs" data-doc-tabs data-testid="nc-doc-tabs">
    <!-- Tab header bar -->
    <div
      class="nc-doc-tabs-header"
      role="tablist"
      contenteditable="false"
      data-testid="nc-doc-tabs-header"
      @click="onChromeClick"
    >
      <template v-for="(tab, index) in tabs" :key="index">
        <!-- Rename input -->
        <input
          v-if="editingTabIndex === index"
          v-model="editingTitle"
          class="nc-doc-tab-rename-input"
          :data-testid="`nc-doc-tab-rename-${index}`"
          maxlength="50"
          @blur="commitRename"
          @keydown="onRenameKeydown"
          @vue:mounted="({ el }: any) => el.focus()"
        />

        <!-- Tab button with dropdown for active tab -->
        <NcDropdown
          v-else
          :visible="isMenuOpen && menuTabIndex === index"
          placement="bottomLeft"
          @update:visible="(v: boolean) => { if (!v) isMenuOpen = false }"
        >
          <button
            class="nc-doc-tab-btn"
            :class="{ active: index === activeTab }"
            role="tab"
            :aria-selected="index === activeTab"
            :data-testid="`nc-doc-tab-btn-${index}`"
            @click.stop="onTabClick(index)"
          >
            {{ tab.title }}
          </button>

          <template #overlay>
            <div class="nc-slash-menu" style="min-width: 140px" data-testid="nc-doc-tab-menu">
              <div
                class="nc-slash-menu-item"
                data-testid="nc-doc-tab-menu-rename"
                @click="onMenuRename"
              >
                <span class="nc-slash-menu-icon">
                  <GeneralIcon icon="rename" />
                </span>
                <span class="nc-slash-menu-label">{{ $t('general.rename') }}</span>
              </div>
              <div
                class="nc-slash-menu-item"
                data-testid="nc-doc-tab-menu-delete"
                @click="onMenuDelete"
              >
                <span class="nc-slash-menu-icon nc-doc-tab-menu-delete-icon">
                  <GeneralIcon icon="delete" />
                </span>
                <span class="nc-slash-menu-label nc-doc-tab-menu-delete-label">{{ $t('general.delete') }}</span>
              </div>
            </div>
          </template>
        </NcDropdown>
      </template>
    </div>

    <!-- Tab content panes -->
    <NodeViewContent
      class="nc-doc-tabs-content"
      :data-active-tab="activeTab"
      role="tabpanel"
      data-testid="nc-doc-tabs-content"
    />
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.nc-doc-tabs {
  @apply border-1 border-nc-border-gray-medium rounded-lg my-3;
}

.nc-doc-tabs-header {
  @apply flex gap-1 px-3 pt-2 pb-0;
}

.nc-doc-tab-btn {
  @apply px-3 py-1 mb-1.5 text-bodySm cursor-pointer rounded-md transition-colors;
  @apply text-nc-content-gray-muted bg-transparent border-0;

  &.active {
    @apply text-nc-content-gray bg-nc-bg-gray-light font-semibold;
  }

  &:hover:not(.active) {
    @apply bg-nc-bg-gray-light bg-opacity-50;
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
  &[data-active-tab='2'] :deep([data-doc-tab]:nth-child(3)) {
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

  ::selection {
    background: transparent;
  }
}
</style>
