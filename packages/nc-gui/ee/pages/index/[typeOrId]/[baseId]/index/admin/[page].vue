<script setup lang="ts">
const route = useRoute()

const slugToTab: Record<string, string> = {
  members: 'collaborator',
  'data-sources': 'data-source',
  permissions: 'permissions',
  syncs: 'syncs',
  settings: 'base-settings',
  audits: 'audits',
  workflows: 'workflows',
  overview: 'overview',
  mcp: 'mcp',
  snapshots: 'snapshots',
}

const tab = computed(() => slugToTab[route.params.page as string] || 'collaborator')
</script>

<template>
  <ProjectView :tab="tab" />
</template>
