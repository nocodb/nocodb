<script setup lang="ts">
/**
 * NodeView component for embedded URL previews (YouTube, Vimeo, etc.).
 *
 * Renders an iframe with the embed URL, wrapped in a responsive 16:9 container.
 * Shows platform label and a delete button on hover/selection.
 */
import { NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps<{
  node: any
  updateAttributes: (attrs: Record<string, any>) => void
  deleteNode: () => void
  selected: boolean
  editor: any
}>()

const embedSrc = computed(() => props.node.attrs.src || '')
</script>

<template>
  <NodeViewWrapper class="nc-embed-wrapper" data-drag-handle data-testid="nc-doc-embed">
    <div class="nc-embed-card" :class="{ 'nc-embed-selected': selected }">
      <!-- 16:9 responsive iframe container -->
      <div class="nc-embed-iframe-wrapper">
        <iframe
          v-if="embedSrc"
          :src="embedSrc"
          class="nc-embed-iframe"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />
      </div>

      <!-- Delete button — floating top-right on hover -->
      <button v-if="editor?.isEditable" class="nc-embed-delete" @click.stop="deleteNode">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  </NodeViewWrapper>
</template>
