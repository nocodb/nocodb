<script lang="ts" setup>
import type { WorkflowType } from 'nocodb-sdk'

const props = defineProps<{
  workflow: WorkflowType
}>()
const meta = computed(() => props.workflow.meta as Record<string, any> | undefined)
const icon = computed<string>(() => meta.value?.icon)
</script>

<template>
  <LazyGeneralEmojiPicker v-if="icon" :data-testid="`nc-emoji-${icon}`" class="text-lg" size="small" :emoji="icon" readonly />
  <component :is="iconMap.ncAutomation" v-else class="w-4 mx-0.75" />
</template>
