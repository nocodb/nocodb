<script lang="ts" setup>
import { Icon as IcIcon } from '@iconify/vue'
import type { TableType } from 'nocodb-sdk'

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

  <MdiEyeCircleOutline v-else-if="tableMeta?.type === 'view'" class="w-5" />
  <MdiTableLarge v-else class="w-5" />
</template>
