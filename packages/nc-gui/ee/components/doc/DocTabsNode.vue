<script setup lang="ts">
import type { Node as PmNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/vue-3'

interface Props {
  node: PmNode
  editor: Editor
  getPos: () => number
}

const props = defineProps<Props>()

// Local UI state — not persisted in the document model.
// Avoids undo/redo pollution and collaboration conflicts.
const activeTab = ref(0)

const tabs = computed(() => {
  const result: { title: string }[] = []
  props.node.content.forEach((child) => {
    result.push({ title: child.attrs?.title || 'Tab' })
  })
  return result
})

function switchTab(index: number) {
  if (index === activeTab.value) return

  activeTab.value = index

  // Move cursor to the start of the newly active tab's content
  // so it doesn't get stranded in hidden tab content.
  nextTick(() => {
    const pos = props.getPos()
    if (typeof pos !== 'number') return

    // Walk into the docTabs node to find the nth docTab child
    let offset = pos + 1 // skip the docTabs opening
    for (let i = 0; i < index; i++) {
      offset += props.node.child(i).nodeSize
    }
    // +1 to enter the docTab, +1 to enter its first child block
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
</script>

<template>
  <NodeViewWrapper class="nc-doc-tabs" data-doc-tabs data-testid="nc-doc-tabs">
    <!-- Tab header bar -->
    <div
      class="nc-doc-tabs-header"
      role="tablist"
      contenteditable="false"
      data-testid="nc-doc-tabs-header"
    >
      <button
        v-for="(tab, index) in tabs"
        :key="index"
        class="nc-doc-tab-btn"
        :class="{ active: index === activeTab }"
        role="tab"
        :aria-selected="index === activeTab"
        :data-testid="`nc-doc-tab-btn-${index}`"
        @click="switchTab(index)"
      >
        {{ tab.title }}
      </button>
    </div>

    <!-- Tab content panes — ProseMirror renders docTab children here.
         data-active-tab drives pure CSS visibility — no JS DOM manipulation needed. -->
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

// Inactive tabs: collapsed but still in DOM for ProseMirror position mapping.
// Using display:none breaks ProseMirror entirely.
// Pure CSS driven by data-active-tab attribute — no JS DOM manipulation.
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
