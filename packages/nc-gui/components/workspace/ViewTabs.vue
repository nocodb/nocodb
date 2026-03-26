<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

const router = useRouter()
const route = router.currentRoute

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { activeWorkspace, isTeamsEnabled } = storeToRefs(workspaceStore)
const { loadCollaborators } = workspaceStore

const { appInfo, isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const {
  isWsAuditEnabled,
  isPaymentEnabled,
  isEEFeatureBlocked,
  getFeature,
  handleUpgradePlan,
  showUpgradeToUseTeams,
  showEEFeatures,
} = useEeConfig()

const hasTeamsEditPermission = computed(() => {
  return isEeUI && isTeamsEnabled.value && isUIAllowed('teamCreate')
})

const isWorkspaceSsoAvail = computed(() => {
  return isEeUI && !!appInfo.value?.isCloud && !!getFeature(PlanFeatureTypes.FEATURE_SSO)
})

const routeNameToWsTab: Record<string, string> = {
  'index-typeOrId-index': 'bases',
  'index-typeOrId': 'bases',
  'index-typeOrId-members': 'collaborators',
  'index-typeOrId-teams': 'teams',
  'index-typeOrId-integrations': 'integrations',
  'index-typeOrId-audits': 'audits',
  'index-typeOrId-billing': 'billing',
  'index-typeOrId-sso': 'sso',
  'index-typeOrId-settings': 'settings',
}

const wsTabToRouteName: Record<string, string> = Object.fromEntries(Object.entries(routeNameToWsTab).map(([k, v]) => [v, k]))

// Tab definitions
interface TabItem {
  key: string
  icon: string
  label: string
  upgradeBadge?: { feature: string; enabledCallback: () => boolean }
}

const tabItems = computed<TabItem[]>(() => {
  const items: TabItem[] = [{ key: 'bases', icon: 'ncDatabase', label: t('objects.projects') }]

  if (isUIAllowed('workspaceCollaborators')) {
    items.push({ key: 'collaborators', icon: 'users', label: t('labels.members') })
  }

  if (isEeUI && hasTeamsEditPermission.value && showEEFeatures.value) {
    items.push({
      key: 'teams',
      icon: 'ncBuilding',
      label: t('general.teams'),
      upgradeBadge: { feature: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT, enabledCallback: () => !isEEFeatureBlocked.value },
    })
  }

  if (!isMobileMode.value) {
    if (isUIAllowed('workspaceIntegrations')) {
      items.push({ key: 'integrations', icon: 'integration', label: t('general.integrations') })
    }

    if (isEeUI && isPaymentEnabled.value && isUIAllowed('workspaceBilling') && showEEFeatures.value) {
      items.push({ key: 'billing', icon: 'ncDollarSign', label: t('general.billing') })
    }

    if (isEeUI && isUIAllowed('workspaceAuditList') && showEEFeatures.value) {
      items.push({
        key: 'audits',
        icon: 'audit',
        label: t('title.audits'),
        upgradeBadge: { feature: PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE, enabledCallback: () => isWsAuditEnabled.value },
      })
    }

    if (isWorkspaceSsoAvail.value && isUIAllowed('workspaceSSO') && showEEFeatures.value) {
      items.push({ key: 'sso', icon: 'sso', label: t('title.sso') })
    }
  }

  if (!isEEFeatureBlocked.value) {
    items.push({ key: 'settings', icon: 'ncSettings', label: t('labels.settings') })
  }

  return items
})

const activeTab = computed({
  get() {
    return routeNameToWsTab[route.value.name as string] || 'bases'
  },
  set(tabKey: string) {
    if (!isWsAuditEnabled.value && tabKey === 'audits') {
      handleUpgradePlan({
        title: t('upgrade.upgradeToAccessWsAudit'),
        content: t('upgrade.upgradeToAccessWsAuditSubtitle', { plan: PlanTitles.ENTERPRISE }),
        limitOrFeature: PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE,
      })
      return
    }

    if (isEeUI && tabKey === 'teams' && hasTeamsEditPermission.value && showUpgradeToUseTeams()) return

    if (['collaborators', 'teams'].includes(tabKey) && isUIAllowed('workspaceCollaborators')) {
      loadCollaborators({}, activeWorkspace.value?.id)
    }

    const typeOrId = route.value.params.typeOrId || activeWorkspace.value?.id || 'nc'
    router.push({ name: wsTabToRouteName[tabKey] || 'index-typeOrId', params: { typeOrId } })
  },
})
</script>

<template>
  <NcTabs v-model:active-key="activeTab" class="nc-ws-view-tabs">
    <template #leftExtra>
      <div class="w-3"></div>
    </template>

    <a-tab-pane v-for="item in tabItems" :key="item.key">
      <template #tab>
        <div class="tab-title">
          <GeneralIcon :icon="item.icon" class="h-4 w-4" />
          {{ item.label }}
          <LazyPaymentUpgradeBadge
            v-if="item.upgradeBadge"
            :feature="item.upgradeBadge.feature"
            :feature-enabled-callback="item.upgradeBadge.enabledCallback"
            remove-click
          />
        </div>
      </template>
    </a-tab-pane>
  </NcTabs>
</template>

<style lang="scss" scoped>
.nc-ws-view-tabs {
  @apply flex-none w-full;

  :deep(.ant-tabs-content-holder) {
    @apply !hidden;
  }

  :deep(.ant-tabs-nav) {
    @apply !pl-0 !mb-0;
  }

  :deep(.ant-tabs-tab) {
    @apply pt-2 pb-3;
  }

  :deep(.ant-tabs-tab + .ant-tabs-tab) {
    @apply !ml-3;
  }
}

.tab-title {
  @apply flex flex-row items-center gap-x-2 py-[1px];
}
</style>
