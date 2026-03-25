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
} = useEeConfig()

const hasTeamsEditPermission = computed(() => {
  return isEeUI && isTeamsEnabled.value && isUIAllowed('teamCreate')
})

const isWorkspaceSsoAvail = computed(() => {
  if (isEeUI && appInfo.value?.isCloud && getFeature(PlanFeatureTypes.FEATURE_SSO)) {
    return true
  }
  return false
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

const wsTabToRouteName: Record<string, string> = Object.fromEntries(
  Object.entries(routeNameToWsTab).map(([k, v]) => [v, k]),
)

const activeTab = computed(() => {
  return routeNameToWsTab[route.value.name as string] || 'bases'
})

const onTabChange = (tabKey: string) => {
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

  router.push({ name: wsTabToRouteName[tabKey] || 'index-typeOrId' })
}

// Tab definitions — built dynamically based on permissions
interface TabItem {
  key: string
  icon: string
  label: string
  badge?: any
}

const tabItems = computed<TabItem[]>(() => {
  const items: TabItem[] = [
    { key: 'bases', icon: 'ncDatabase', label: t('objects.projects') },
  ]

  if (isUIAllowed('workspaceCollaborators')) {
    items.push({ key: 'collaborators', icon: 'users', label: t('labels.members') })
  }

  if (isEeUI && hasTeamsEditPermission.value) {
    items.push({ key: 'teams', icon: 'ncBuilding', label: t('general.teams') })
  }

  if (!isMobileMode.value) {
    if (isUIAllowed('workspaceIntegrations')) {
      items.push({ key: 'integrations', icon: 'integration', label: t('general.integrations') })
    }

    if (isEeUI && isPaymentEnabled.value && isUIAllowed('workspaceBilling')) {
      items.push({ key: 'billing', icon: 'ncDollarSign', label: t('general.billing') })
    }

    if (isEeUI && isUIAllowed('workspaceAuditList')) {
      items.push({ key: 'audits', icon: 'audit', label: t('title.audits') })
    }

    if (isWorkspaceSsoAvail.value && isUIAllowed('workspaceSSO')) {
      items.push({ key: 'sso', icon: 'sso', label: t('title.sso') })
    }
  }

  if (!isEEFeatureBlocked.value) {
    items.push({ key: 'settings', icon: 'ncSettings', label: t('labels.settings') })
  }

  return items
})
</script>

<template>
  <div class="nc-ws-view-tabs flex items-center border-b-1 border-nc-border-gray-medium overflow-x-auto nc-scrollbar-thin">
    <div class="w-3 flex-shrink-0" />
    <div
      v-for="item in tabItems"
      :key="item.key"
      class="tab-title"
      :class="{ active: activeTab === item.key }"
      @click="onTabChange(item.key)"
    >
      <GeneralIcon :icon="item.icon" class="h-4 w-4 flex-none" />
      <span>{{ item.label }}</span>
      <LazyPaymentUpgradeBadge
        v-if="item.key === 'teams'"
        :feature="PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT"
        :feature-enabled-callback="() => !isEEFeatureBlocked"
        remove-click
      />
      <LazyPaymentUpgradeBadge
        v-if="item.key === 'audits'"
        :feature="PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE"
        :feature-enabled-callback="() => isWsAuditEnabled"
        remove-click
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tab-title {
  @apply flex items-center gap-2 px-3 py-2.5 cursor-pointer text-bodyDefaultSm font-medium
    whitespace-nowrap border-b-2 border-transparent
    text-nc-content-gray-muted transition-colors duration-150;

  &:hover {
    @apply text-nc-content-gray-subtle;
  }

  &.active {
    @apply border-nc-border-brand !text-nc-content-brand font-semibold;
  }
}
</style>
