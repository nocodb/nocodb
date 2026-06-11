<script lang="ts" setup>
const { isFeatureEnabled } = useBetaFeatureToggle()

// Check if optimized kanban is enabled via feature flag
const isOptimizedKanbanEnabled = computed(() => isFeatureEnabled('kanban_opt'))
</script>

<template>
  <!-- Switch between legacy and optimized kanban based on feature flag -->
  <LazySmartsheetKanban v-if="!isOptimizedKanbanEnabled" />
  <LazySmartsheetKanbanOptimized v-else />
</template>
