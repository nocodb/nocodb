<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk'
const props = defineProps<{
  table: TableType
}>()
const meta = computed(() => props.table.meta as Record<string, any> | undefined)
const icon = computed<string>(() => meta.value?.icon)
const type = computed<string>(() => meta.value?.type)
</script>

<template>
  <LazyGeneralEmojiPicker v-if="icon" :data-testid="`nc-emoji-${icon}`" class="text-lg" size="xsmall" :emoji="icon" readonly />
  <component :is="iconMap.ncZap" v-else-if="table?.synced" class="w-4 mx-0.5 text-nc-gray-600 opacity-75 flex-none" />
  <component :is="iconMap.eye" v-else-if="type === 'view'" class="w-4 mx-0.75 flex-none" />
  <component :is="iconMap.table" v-else class="w-4 mx-0.5 text-nc-gray-600 opacity-75 flex-none" />
</template>
