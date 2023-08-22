<script lang="ts" setup>
import { Icon as IcIcon } from '@iconify/vue'
import type { TableType } from 'nocodb-sdk'
import { iconMap } from '#imports'

const { meta: tableMeta } = defineProps<{
  meta: TableType
}>()
</script>

<template>
  <IcIcon
    v-if="tableMeta.meta?.icon"
    :data-testid="`nc-icon-${tableMeta.meta?.icon}`"
    class="text-lg"
    :icon="tableMeta.meta?.icon"
  />

  <component :is="iconMap.eye" v-else-if="tableMeta?.type === 'view'" class="w-5" />
  <component :is="iconMap.table" v-else class="w-5" />
</template>
