<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk'

const props = defineProps<{
  meta: TableType
  ignoreColor?: boolean
}>()

const viewMeta = toRef(props, 'meta')
</script>

<template>
  <LazyGeneralEmojiPicker
    v-if="viewMeta?.meta?.icon"
    :data-testid="`nc-emoji-${viewMeta.meta?.icon}`"
    size="xsmall"
    :emoji="viewMeta.meta?.icon"
    readonly
  />
  <component
    :is="viewIcons[viewMeta.type]?.icon"
    v-else-if="viewMeta?.type"
    class="nc-view-icon group-hover"
    :style="{
      color: !props.ignoreColor ? viewIcons[viewMeta.type]?.color : undefined,
      fontWeight: 500,
    }"
  />
</template>

<style>
.nc-view-icon {
  font-size: 1.05rem;
}
</style>
