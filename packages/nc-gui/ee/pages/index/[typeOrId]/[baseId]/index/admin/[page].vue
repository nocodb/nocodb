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
  // Workspace settings (rendered inline in base admin)
  'ws-members': 'ws-collaborators',
  'ws-teams': 'ws-teams',
  'ws-integrations': 'ws-integrations',
  'ws-billing': 'ws-billing',
  'ws-audits': 'ws-audits',
  'ws-sso': 'ws-sso',
  'ws-settings': 'ws-settings',
}

const tab = computed(() => slugToTab[route.params.page as string] || 'collaborator')
</script>

<template>
  <ProjectView :tab="tab" />
</template>
