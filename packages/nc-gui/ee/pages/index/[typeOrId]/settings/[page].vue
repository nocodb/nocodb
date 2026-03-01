<script setup lang="ts">
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const route = useRoute()

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const tab = computed(() => wsAdminSlugToTab[route.params.page as string] || 'ws-collaborators')

const sidebarStore = useSidebarStore()

const { activeSidebarTab } = storeToRefs(sidebarStore)

// Ensure settings tab is active when on ws-settings route
activeSidebarTab.value = 'settings'
</script>

<template>
  <div v-if="activeWorkspace?.id" class="h-full">
    <ProjectView :tab="tab" />
  </div>
</template>
