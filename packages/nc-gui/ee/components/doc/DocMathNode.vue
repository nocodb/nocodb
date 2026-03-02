<script lang="ts">
// Module-level singleton — shared across all DocMathNode instances.
// KaTeX CSS is injected once as a side-effect import (Vite deduplicates it).
type KatexRender = (tex: string, opts: Record<string, any>) => string
let _katexPromise: Promise<KatexRender> | null = null

function loadKatex(): Promise<KatexRender> {
  if (!_katexPromise) {
    _katexPromise = Promise.all([
      import('katex'),
      import('katex/dist/katex.min.css'),
    ]).then(([mod]) => mod.default.renderToString)
  }
  return _katexPromise
}
</script>

<script setup lang="ts">
import { NodeViewWrapper } from '@tiptap/vue-3'
import type { Node } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'

interface Props {
  node: Node
  updateAttributes: (attrs: Record<string, any>) => void
  selected: boolean
  editor: Editor
  deleteNode: () => void
  getPos: () => number
}

const props = defineProps<Props>()

const isEditing = ref(false)
const editValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const latex = computed(() => props.node.attrs.latex as string)

let katexRender: KatexRender | null = null
const katexReady = ref(false)

onMounted(async () => {
  katexRender = await loadKatex()
  katexReady.value = true
})

// Render once; track both HTML and error state together
const renderResult = computed<{ html: string; error: boolean }>(() => {
  if (!katexReady.value || !katexRender || !latex.value) return { html: '', error: false }
  try {
    return { html: katexRender(latex.value, { throwOnError: true, displayMode: false }), error: false }
  } catch {
    return { html: '', error: true }
  }
})

const renderedHtml = computed(() => renderResult.value.html)
const hasError = computed(() => renderResult.value.error)

const isEmpty = computed(() => !latex.value)

const startEditing = () => {
  if (!props.editor.isEditable) return
  editValue.value = latex.value
  isEditing.value = true
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

const saveEdit = () => {
  const trimmed = editValue.value.trim()
  if (!trimmed) {
    props.deleteNode()
    return
  }
  props.updateAttributes({ latex: trimmed })
  isEditing.value = false
}

const cancelEdit = () => {
  if (isEmpty.value) {
    props.deleteNode()
    return
  }
  isEditing.value = false
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    saveEdit()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
  }
}

// Auto-open edit mode when inserted empty (via slash command)
watch(
  () => props.selected,
  (selected) => {
    if (selected && isEmpty.value && !isEditing.value) {
      startEditing()
    }
  },
  { immediate: true },
)
</script>

<template>
  <NodeViewWrapper
    as="span"
    class="nc-inline-math-wrapper"
    :class="{
      'nc-inline-math-selected': selected && !isEditing,
      'nc-inline-math-empty': isEmpty && !isEditing,
      'nc-inline-math-editing': isEditing,
    }"
  >
    <!-- Edit mode: show input -->
    <span v-if="isEditing" class="nc-inline-math-editor" contenteditable="false">
      <span class="nc-math-dollar">$</span>
      <input
        ref="inputRef"
        v-model="editValue"
        class="nc-math-input"
        placeholder="E=mc^2"
        spellcheck="false"
        @keydown="onKeyDown"
        @blur="saveEdit"
      />
      <span class="nc-math-dollar">$</span>
    </span>

    <!-- Display mode: rendered KaTeX -->
    <span
      v-else-if="!isEmpty && renderedHtml"
      class="nc-inline-math-display"
      contenteditable="false"
      @click="startEditing"
      v-html="renderedHtml"
    />

    <!-- Error state: show raw LaTeX in monospace -->
    <span
      v-else-if="!isEmpty && hasError"
      class="nc-inline-math-display nc-math-error-display"
      contenteditable="false"
      @click="startEditing"
    >
      {{ latex }}
    </span>

    <!-- Empty placeholder -->
    <span
      v-else
      class="nc-inline-math-display nc-math-placeholder"
      contenteditable="false"
      @click="startEditing"
    >
      equation
    </span>
  </NodeViewWrapper>
</template>

<style lang="scss">
.nc-inline-math-wrapper {
  display: inline;
  cursor: pointer;

  &.nc-inline-math-selected .nc-inline-math-display {
    outline: 2px solid var(--nc-fill-primary);
    outline-offset: 1px;
    border-radius: 3px;
  }
}

.nc-inline-math-display {
  display: inline;
  padding: 1px 3px;
  border-radius: 3px;
  vertical-align: baseline;
  transition: background-color 0.1s;

  &:hover {
    background-color: var(--nc-bg-gray-light);
  }

  &.nc-math-placeholder {
    color: var(--nc-content-gray-disabled);
    font-style: italic;
    font-size: 0.9em;
  }

  &.nc-math-error-display {
    color: var(--nc-content-red-dark);
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    font-size: 0.85em;
    text-decoration: wavy underline var(--nc-content-red-dark);
  }

  // KaTeX container alignment fixes
  .katex {
    font-size: 1.05em;
  }
}

.nc-inline-math-editor {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--nc-bg-gray-light);
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 4px;
  padding: 1px 4px;
  vertical-align: baseline;
}

.nc-math-dollar {
  color: var(--nc-content-gray-muted);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 0.85em;
  user-select: none;
}

.nc-math-input {
  border: none;
  outline: none;
  background: transparent;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 0.85em;
  color: var(--nc-content-gray);
  min-width: 60px;
  width: auto;
  padding: 0;
  line-height: inherit;

  &::placeholder {
    color: var(--nc-content-gray-disabled);
  }
}
</style>
