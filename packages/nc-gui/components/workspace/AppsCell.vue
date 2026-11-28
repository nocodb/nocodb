<script setup lang="ts">
import type { WorkspaceUserAppRef } from 'nocodb-sdk'

defineProps<{
  apps: WorkspaceUserAppRef[]
}>()
</script>

<template>
  <NcSpanHidden />
</template>
