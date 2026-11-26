<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'

defineProps<{ column: ColumnType; disabled?: boolean }>()
</script>

<template>
  <NcSpanHidden />
</template>
