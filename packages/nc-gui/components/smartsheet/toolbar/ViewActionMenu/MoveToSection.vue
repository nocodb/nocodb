<script lang="ts" setup>
import type { TableType, ViewType } from 'nocodb-sdk'

interface Props {
  view: ViewType
  table: TableType
  inSidebar?: boolean
}

defineProps<Props>()

const emits = defineEmits(['closeModal'])
</script>

<template>
  <NcSpanHidden />
</template>
