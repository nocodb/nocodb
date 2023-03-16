<script lang="ts" setup>
import { Icon as IcIcon } from '@iconify/vue'
import type { TableType, ViewType } from 'nocodb-sdk'
import { toRef, viewIcons } from '#imports'

const props = defineProps<{
  meta: TableType | ViewType
}>()

const viewMeta = toRef(props, 'meta')
</script>

<template v-if="viewMeta">
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
    :style="{ color: viewIcons[viewMeta.type]?.color }"
  />
</template>

<style scoped></style>
