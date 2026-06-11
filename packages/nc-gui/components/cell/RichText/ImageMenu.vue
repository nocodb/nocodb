<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import type { TooltipPlacement } from 'ant-design-vue/es/tooltip'

interface Props {
  editor: Editor
  tabIndex?: number
  tooltipPlacement?: TooltipPlacement
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
