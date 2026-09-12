<script setup lang="ts">
import type { CommentHookConfigType } from 'nocodb-sdk'

// CE stub — comment webhooks are EE-only. The EE overlay
// (ee/components/webhook/CommentFilters.vue) provides the real UI.
defineProps<{ modelValue?: CommentHookConfigType | null }>()

defineEmits<{ 'update:modelValue': [value: CommentHookConfigType] }>()
</script>

<template>
  <NcSpanHidden />
</template>
