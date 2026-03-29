<script lang="ts" setup>
import type { Node } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'

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
