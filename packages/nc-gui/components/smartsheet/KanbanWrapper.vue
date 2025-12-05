<script lang="ts" setup>
import { computed } from 'vue'
import Kanban from './Kanban.vue'
import KanbanOptimized from './KanbanOptimized.vue'
import { useBetaFeatureToggle } from '#imports'

const { isFeatureEnabled } = useBetaFeatureToggle()

// Check if optimized kanban is enabled via feature flag
const isOptimizedKanbanEnabled = computed(() => isFeatureEnabled('kanban_opt'))
</script>

<template>
  <!-- Switch between legacy and optimized kanban based on feature flag -->
  <Kanban v-if="!isOptimizedKanbanEnabled" />
  <KanbanOptimized v-else />
</template>
