<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
const { node } = defineProps(nodeViewProps)
</script>

<template>
  <NodeViewWrapper class="vue-component callout-wrapper">
    <div
      class="flex flex-row items-center gap-x-3 break-all"
      :class="{
        'info-callout': node.type.name === 'infoCallout',
        'warning-callout': node.type.name === 'warningCallout',
        'tip-callout': node.type.name === 'tipCallout',
      }"
    >
      <IcOutlineInfo v-if="node.type.name === 'infoCallout'" class="min-w-4" style="color: #2696db" />
      <IcBaselineErrorOutline v-if="node.type.name === 'warningCallout'" class="min-w-4" style="color: #ff4a3f" />
      <IcRoundStarBorder v-if="node.type.name === 'tipCallout'" class="min-w-4" style="color: #fcbe3a" />
      <NodeViewContent class="" />
    </div>
  </NodeViewWrapper>
</template>
