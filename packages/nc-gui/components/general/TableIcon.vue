<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk'

const { meta: tableMeta } = defineProps<{
  meta?: TableType
}>()
</script>

<template>
  <LazyGeneralEmojiPicker
    v-if="tableMeta?.meta?.icon"
    :data-testid="`nc-emoji-${tableMeta.meta?.icon}`"
    class="text-lg"
    size="small"
    :emoji="tableMeta.meta?.icon"
    readonly
  />

  <component :is="iconMap.ncZap" v-else-if="tableMeta?.synced" class="w-4 mx-0.5 text-sm text-nc-gray-600 opacity-75 flex-none" />
  <component :is="iconMap.eye" v-else-if="tableMeta?.type === 'view'" class="w-4 mx-0.75 flex-none" />
  <component :is="iconMap.table" v-else class="w-4 mx-0.5 text-nc-gray-600 opacity-80 flex-none" />
</template>
