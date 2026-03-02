<script lang="ts" setup>
const router = useRouter()
const route = router.currentRoute

const sidebarStore = useSidebarStore()
const { activeSidebarTab } = storeToRefs(sidebarStore)

const { isUIAllowed } = useRoles()

const navigateToWsSettings = (page: string) => {
  const wsId = route.value.params.typeOrId
  const slug = wsSettingsTabToSlug[page] || page
  navigateTo(`/${wsId}/settings/${slug}`)
}

const activeSettingsPage = computed(() => {
  if (activeSidebarTab.value !== 'settings') return ''
  return (route.value.params.page as string) || ''
})

const isWsSettingsItemActive = (tab: string) => {
  const slug = wsSettingsTabToSlug[tab] || tab
  return activeSettingsPage.value === slug
}
</script>

<template>
  <div class="nc-project-home-section">
    <div class="nc-settings-section-header">
      {{ $t('objects.workspace') }} {{ $t('labels.settings') }}
    </div>
    <NcSidebarMenuItem
      v-if="isUIAllowed('workspaceCollaborators')"
      v-e="['c:admin:ws:invite-user']"
      icon="users"
      :active="isWsSettingsItemActive('ws-collaborators')"
      @click="navigateToWsSettings('ws-collaborators')"
    >
      {{ $t('labels.inviteUsersToWorkspace') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isUIAllowed('workspaceIntegrations')"
      v-e="['c:integrations']"
      icon="integration"
      :active="isWsSettingsItemActive('ws-integrations')"
      @click="navigateToWsSettings('ws-integrations')"
    >
      {{ $t('general.integrations') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators')"
      v-e="['c:admin:ws:general']"
      icon="ncMoreHorizontal"
      :active="isWsSettingsItemActive('ws-settings')"
      @click="navigateToWsSettings('ws-settings')"
    >
      {{ $t('general.general') }}
    </NcSidebarMenuItem>
  </div>
</template>

<style lang="scss" scoped>
.nc-settings-section-header {
  @apply px-3 pt-3 pb-1 font-semibold text-nc-content-brand uppercase tracking-wide;
  font-size: 13px;
}
</style>
