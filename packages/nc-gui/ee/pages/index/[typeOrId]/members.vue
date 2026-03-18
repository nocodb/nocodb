<script setup lang="ts">
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const route = useRoute()

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)
</script>

<template>
  <div v-if="activeWorkspace?.id" class="h-full">
    <WorkspaceViewInline :tab="'ws-collaborators'" />
  </div>
</template>
