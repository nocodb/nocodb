<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import { type Node } from '@tiptap/core'

interface Props {
  editor: Editor
  tabIndex?: number
  isAddImageMode: boolean
  isImageEditMode: boolean
  imageNode: Node
}

withDefaults(defineProps<Props>(), {})

defineEmits(['update:isAddImageMode', 'update:isImageEditMode'])
</script>

<template>
  <NcSpanHidden />
</template>
