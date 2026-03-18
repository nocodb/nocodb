<script setup lang="ts">
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)
</script>

<template>
  <div v-if="activeWorkspace?.id" class="h-full">
    <WorkspaceHome ws-tab="ws-audits" />
  </div>
</template>
