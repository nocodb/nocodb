<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const { getPos, editor } = defineProps(nodeViewProps)
const isPublic = !editor.view.editable
</script>

<template>
  <NodeViewWrapper class="tiptap-table-wrapper">
    <NodeViewContent as="table" />
  </NodeViewWrapper>
</template>

<style lang="scss">
.tiptap-table-wrapper {
  table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    margin-top: 2rem;
    margin-bottom: 2rem;
    overflow: visible;
    tbody {
      overflow: visible;
    }
    td,
    th {
      position: relative;
      min-width: 1em;
      border: 1px solid #e5e5e5;
      vertical-align: top;
      box-sizing: border-box;
      overflow: visible !important;
      height: 20px;
      > * {
        margin-bottom: 0;
      }
    }

    td {
      overflow: visible !important;
      border-top: 0;
    }

    th {
      @apply font-semibold;
      text-align: left;
      background-color: #fafbfb;
    }

    .column-resize-handle {
      position: absolute;
      right: 0px;
      top: 0;
      bottom: 0px;
      margin-top: 1px;
      margin-bottom: 1px;
      width: 4px;
      outline: 1px solid #e3e5ff;
    }

    p {
      margin: 0;
    }

    tr.ProseMirror-selectednode {
      @apply bg-primary-selected;
    }

    .column-resize-handle {
      background-color: #e3e5ff !important;
      width: 6px;
      cursor: col-resize;
      z-index: 1;
    }
  }
}
</style>
