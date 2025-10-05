<script lang="ts" setup>
import type { ScriptType } from 'nocodb-sdk'

const props = defineProps<{
  automation: ScriptType
}>()
const meta = computed(() => props.automation.meta as Record<string, any> | undefined)
const icon = computed<string>(() => meta.value?.icon)
</script>

<template>
  <LazyGeneralEmojiPicker v-if="icon" :data-testid="`nc-emoji-${icon}`" class="text-lg" size="small" :emoji="icon" readonly />
  <component :is="iconMap.ncScript" v-else class="w-4 mx-0.75" />
</template>
