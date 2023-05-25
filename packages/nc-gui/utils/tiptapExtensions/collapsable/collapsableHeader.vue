<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const { node } = defineProps(nodeViewProps)
</script>

<template>
  <NodeViewWrapper class="vue-component">
    <div class="collapsable-header-wrapper" data-tiptap-heading-group="true">
      <NodeViewContent class="w-full" :data-is-empty="node.textContent.length === 0" />
    </div>
  </NodeViewWrapper>
</template>
