<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'

interface Props {
  editor: Editor
  tabIndex?: number
  isAddImageMode: boolean
  isImageEditMode: boolean
  isImageOptionsVisible: boolean
  imageNode: any
}

withDefaults(defineProps<Props>(), {})

defineEmits(['blur', 'update:isAddImageMode', 'update:isImageEditMode', 'update:isImageOptionsVisible'])
</script>

<template>
  <NcSpanHidden />
</template>
