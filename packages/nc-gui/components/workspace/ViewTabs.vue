<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

const router = useRouter()
const route = router.currentRoute

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { activeWorkspaceId, isTeamsEnabled } = storeToRefs(workspaceStore)
const { loadCollaborators } = workspaceStore

const { appInfo, isMobileMode } = useGlobal()

const { isUIAllowed, isBaseRolesLoaded } = useRoles()

const { isWsAuditEnabled, isPaymentEnabled, getFeature, handleUpgradePlan, showUpgradeToUseTeams, showEEFeatures, blockScim } =
  useEeConfig()

const hasTeamsEditPermission = computed(() => {
  return isEeUI && isTeamsEnabled.value && isUIAllowed('teamCreate')
})

const isWorkspaceSsoAvail = computed(() => {
  return isEeUI && !!appInfo.value?.isCloud && !!getFeature(PlanFeatureTypes.FEATURE_SSO)
})

// Tab definitions
interface TabItem {
  key: string
  icon: string
  label: string
  upgradeBadge?: { feature: string }
  hidden?: boolean
}

const tabItems = computed<TabItem[]>(() => {
  // Ensure re-evaluation when roles load
  // eslint-disable-next-line no-unused-expressions
  isBaseRolesLoaded.value

  return [
    { key: 'bases', icon: 'ncDatabase', label: t('objects.projects') },
    { key: 'collaborators', icon: 'users', label: t('labels.members'), hidden: !isUIAllowed('workspaceCollaborators') },
    {
      key: 'teams',
      icon: 'ncBuilding',
      label: t('general.teams'),
      hidden: !(isEeUI && hasTeamsEditPermission.value && showEEFeatures.value),
    },
    {
      key: 'integrations',
      icon: 'integration',
      label: t('general.integrations'),
      hidden: isMobileMode.value || !isUIAllowed('workspaceIntegrations'),
    },
    {
      key: 'billing',
      icon: 'ncDollarSign',
      label: t('general.billing'),
      hidden:
        isMobileMode.value || !(isEeUI && isPaymentEnabled.value && isUIAllowed('workspaceBilling') && showEEFeatures.value),
    },
    {
      key: 'audits',
      icon: 'audit',
      label: t('title.audits'),
      hidden: isMobileMode.value || !(isEeUI && isUIAllowed('workspaceAuditList') && showEEFeatures.value),
    },
    {
      key: 'sso',
      icon: 'sso',
      label: t('title.sso'),
      hidden: isMobileMode.value || !(isWorkspaceSsoAvail.value && isUIAllowed('workspaceSSO') && showEEFeatures.value),
    },
    {
      key: 'scim',
      icon: 'ncShield',
      label: t('labels.scimProvisioning'),
      hidden: isMobileMode.value || !(!blockScim.value && isEeUI && showEEFeatures.value),
    },
    { key: 'settings', icon: 'ncSettings', label: t('labels.settings'), hidden: !showEEFeatures.value },
  ].filter((item) => !item.hidden)
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
      loadCollaborators({}, activeWorkspaceId.value)
    }

    const typeOrId = route.value.params.typeOrId || activeWorkspaceId.value || 'nc'
    router.push({ name: wsTabToRouteName[tabKey] || 'index-typeOrId', params: { typeOrId } })
  },
})
</script>

<template>
  <NcTabs :key="`${tabItems.length}`" v-model:active-key="activeTab" class="nc-ws-view-tabs">
    <template #leftExtra>
      <div class="w-2 sm:w-4"></div>
    </template>

    <a-tab-pane v-for="item in tabItems" :key="item.key">
      <template #tab>
        <div class="tab-title">
          <GeneralIcon :icon="item.icon" class="h-4 w-4" />
          {{ item.label }}
          <LazyPaymentUpgradeBadge v-if="item.upgradeBadge" :feature="item.upgradeBadge.feature" remove-click />
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
    @apply !ml-2;
  }
}

.tab-title {
  @apply flex flex-row items-center gap-x-2 py-[1px];
}
</style>
