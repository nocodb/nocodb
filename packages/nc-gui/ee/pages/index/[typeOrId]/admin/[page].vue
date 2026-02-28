<script setup lang="ts">
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const route = useRoute()

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const slugToTab: Record<string, string> = {
  'ws-members': 'ws-collaborators',
  'ws-teams': 'ws-teams',
  'ws-integrations': 'ws-integrations',
  'ws-billing': 'ws-billing',
  'ws-audits': 'ws-audits',
  'ws-sso': 'ws-sso',
  'ws-settings': 'ws-settings',
}

const tab = computed(() => slugToTab[route.params.page as string] || 'ws-collaborators')

const sidebarStore = useSidebarStore()

const { activeSidebarTab } = storeToRefs(sidebarStore)

// Ensure admin tab is active when on ws-admin route
activeSidebarTab.value = 'admin'
</script>

<template>
  <div v-if="activeWorkspace?.id" class="h-full">
    <ProjectView :tab="tab" />
  </div>
</template>
