<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

const router = useRouter()
const route = router.currentRoute

const workspaceStore = useWorkspace()
const { activeWorkspace, isTeamsEnabled } = storeToRefs(workspaceStore)

const sidebarStore = useSidebarStore()
const { activeSidebarTab, isLeftSidebarOpen } = storeToRefs(sidebarStore)

const { appInfo, isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { t } = useI18n()

const {
  isWsAuditEnabled,
  isPaymentEnabled,
  isEEFeatureBlocked,
  showEEFeatures,
  getFeature,
  showUpgradeToUseTeams,
  handleUpgradePlan,
} = useEeConfig()

const isWorkspaceSsoAvail = computed(() => {
  return isEeUI && (appInfo.value?.isCloud || appInfo.value?.isOnPrem) && getFeature(PlanFeatureTypes.FEATURE_SSO)
})

const navigateToWsSettings = (page: string) => {
  if (page === 'ws-teams' && showUpgradeToUseTeams()) return

  if (page === 'ws-audits' && !isWsAuditEnabled.value) {
    handleUpgradePlan({
      title: t('upgrade.upgradeToAccessWsAudit'),
      content: t('upgrade.upgradeToAccessWsAuditSubtitle', { plan: PlanTitles.ENTERPRISE }),
      limitOrFeature: PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE,
    })
    return
  }

  const wsId = route.value.params.typeOrId
  const slug = wsSettingsTabToSlug[page] || page
  navigateTo(`/${wsId}/settings/${slug}`)

  if (isMobileMode.value) {
    isLeftSidebarOpen.value = false
  }
}

const activeWsSettingsTab = computed(() => {
  if (activeSidebarTab.value !== 'settings') return ''
  const page = route.value.params.page as string
  return page ? wsSettingsSlugToTab[page] || '' : ''
})
</script>

<template>
  <div class="nc-project-home-section">
    <div class="nc-settings-section-header">{{ $t('objects.workspace') }} {{ $t('labels.settings') }}</div>
    <NcSidebarMenuItem
      v-if="isUIAllowed('workspaceCollaborators')"
      v-e="['c:settings:ws:invite-user']"
      icon="users"
      data-testid="ws-collaborators"
      :active="activeWsSettingsTab === 'ws-collaborators'"
      @click="navigateToWsSettings('ws-collaborators')"
    >
      {{ $t('labels.inviteUsersToWorkspace') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isEeUI && isTeamsEnabled && showEEFeatures"
      v-e="['c:settings:ws:add-team']"
      icon="ncBuilding"
      data-testid="ws-teams"
      :active="activeWsSettingsTab === 'ws-teams'"
      @click="navigateToWsSettings('ws-teams')"
    >
      {{ $t('labels.manageTeams') }}
      <template #extraRight>
        <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT" remove-click />
      </template>
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isUIAllowed('workspaceIntegrations') && !isMobileMode"
      v-e="['c:integrations']"
      icon="integration"
      data-testid="ws-integrations"
      :active="activeWsSettingsTab === 'ws-integrations'"
      @click="navigateToWsSettings('ws-integrations')"
    >
      {{ $t('general.integrations') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="
        isEeUI &&
        !activeWorkspace?.fk_org_id &&
        isPaymentEnabled &&
        isUIAllowed('workspaceBilling') &&
        !isMobileMode &&
        showEEFeatures
      "
      v-e="['c:settings:ws:billing']"
      icon="ncDollarSign"
      data-testid="ws-billing"
      :active="activeWsSettingsTab === 'ws-billing'"
      @click="navigateToWsSettings('ws-billing')"
    >
      {{ $t('general.billing') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isEeUI && isUIAllowed('workspaceAuditList') && !isMobileMode && showEEFeatures"
      v-e="['c:settings:ws:audits']"
      icon="audit"
      data-testid="ws-audits"
      :active="activeWsSettingsTab === 'ws-audits'"
      @click="navigateToWsSettings('ws-audits')"
    >
      {{ $t('title.audits') }}
      <template #extraRight>
        <LazyPaymentUpgradeBadge
          :feature="PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE"
          :feature-enabled-callback="() => isWsAuditEnabled"
          remove-click
        />
      </template>
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isWorkspaceSsoAvail && !activeWorkspace?.fk_org_id && isUIAllowed('workspaceSSO') && !isMobileMode && showEEFeatures"
      v-e="['c:settings:ws:sso']"
      icon="sso"
      data-testid="ws-sso"
      :active="activeWsSettingsTab === 'ws-sso'"
      @click="navigateToWsSettings('ws-sso')"
    >
      {{ $t('title.sso') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="!isEEFeatureBlocked && (isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators'))"
      v-e="['c:settings:ws:general']"
      icon="ncMoreHorizontal"
      data-testid="ws-settings"
      :active="activeWsSettingsTab === 'ws-settings'"
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
