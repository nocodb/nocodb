<script lang="ts" setup>
import type { TeamV3V3Type } from 'nocodb-sdk'

defineEmits<{
  (e: 'created', team: TeamV3V3Type): void
}>()
</script>

<template>
  <NcSpanHidden />
</template>
