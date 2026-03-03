<script setup lang="ts">
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const route = useRoute()

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const tab = computed(() => wsSettingsSlugToTab[route.params.page as string] || 'ws-collaborators')
</script>

<template>
  <div v-if="activeWorkspace?.id" class="h-full">
    <WorkspaceViewInline :tab="tab" />
  </div>
</template>
