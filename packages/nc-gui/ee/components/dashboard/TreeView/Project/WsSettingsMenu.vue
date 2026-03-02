<script lang="ts" setup>
import { PlanFeatureTypes } from 'nocodb-sdk'

const router = useRouter()
const route = router.currentRoute

const workspaceStore = useWorkspace()
const { activeWorkspace, isTeamsEnabled } = storeToRefs(workspaceStore)

const sidebarStore = useSidebarStore()
const { activeSidebarTab } = storeToRefs(sidebarStore)

const { appInfo, isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const {
  isWsAuditEnabled,
  isPaymentEnabled,
  getFeature,
} = useEeConfig()

const isWorkspaceSsoAvail = computed(() => {
  if (isEeUI && appInfo.value?.isCloud && getFeature(PlanFeatureTypes.FEATURE_SSO)) {
    return true
  }
  return false
})

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
      v-if="isEeUI && isTeamsEnabled"
      v-e="['c:admin:ws:add-team']"
      icon="ncBuilding"
      :active="isWsSettingsItemActive('ws-teams')"
      @click="navigateToWsSettings('ws-teams')"
    >
      {{ $t('labels.manageTeams') }}
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
      v-if="isEeUI && !activeWorkspace?.fk_org_id && isPaymentEnabled && isUIAllowed('workspaceBilling') && !isMobileMode"
      v-e="['c:admin:ws:billing']"
      icon="ncDollarSign"
      :active="isWsSettingsItemActive('ws-billing')"
      @click="navigateToWsSettings('ws-billing')"
    >
      {{ $t('general.billing') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isEeUI && isUIAllowed('workspaceAuditList') && !isMobileMode"
      v-e="['c:admin:ws:audits']"
      icon="audit"
      :active="isWsSettingsItemActive('ws-audits')"
      @click="navigateToWsSettings('ws-audits')"
    >
      {{ $t('title.audits') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isWorkspaceSsoAvail && !activeWorkspace?.fk_org_id && isUIAllowed('workspaceSSO') && !isMobileMode"
      v-e="['c:admin:ws:sso']"
      icon="sso"
      :active="isWsSettingsItemActive('ws-sso')"
      @click="navigateToWsSettings('ws-sso')"
    >
      {{ $t('title.sso') }}
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
