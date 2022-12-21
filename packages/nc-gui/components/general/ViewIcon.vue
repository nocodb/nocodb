<script lang="ts" setup>
import { Icon as IcIcon } from '@iconify/vue'
import type { TableType } from 'nocodb-sdk'
import { viewIcons } from '#imports'

const { meta: viewMeta } = defineProps<{
  meta: TableType
}>()
</script>

<template>
  <IcIcon
    v-if="viewMeta?.meta?.icon"
    :data-testid="`nc-icon-${viewMeta?.meta?.icon}`"
    class="text-[16px]"
    :icon="viewMeta?.meta?.icon"
  ></IcIcon>
  <component
    :is="viewIcons[viewMeta.type]?.icon"
    v-else
    class="nc-view-icon group-hover"
    :style="{ color: viewIcons[viewMeta.type]?.color }"
  />
</template>

<style scoped></style>
