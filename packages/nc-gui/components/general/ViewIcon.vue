<script lang="ts" setup>
import { Icon as IcIcon } from '@iconify/vue'
import type { TableType } from 'nocodb-sdk'
import { toRef, viewIcons } from '#imports'

const props = defineProps<{
  meta: TableType
  ignoreColor?: boolean
}>()

const viewMeta = toRef(props, 'meta')
</script>

<template>
  <IcIcon
    v-if="viewMeta?.meta?.icon"
    :data-testid="`nc-icon-${viewMeta?.meta?.icon}`"
    class="text-[16px]"
    :icon="viewMeta?.meta?.icon"
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
