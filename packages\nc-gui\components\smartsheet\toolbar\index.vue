<script lang="ts" setup>
import { ViewTypes } from 'nocodb-sdk'
const { isKanban } = useSmartsheetStoreOrThrow()
</script>

<template>
  <!-- existing toolbar content -->
  <!-- Add compact toggle button for kanban -->
  <LazySmartsheetToolbarKanbanCompact v-if="isKanban" />
</template>
