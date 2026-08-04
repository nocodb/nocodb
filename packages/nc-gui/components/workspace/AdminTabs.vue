<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

const router = useRouter()
const route = router.currentRoute

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { activeWorkspace, activeWorkspaceId } = storeToRefs(workspaceStore)

const { isWsAuditEnabled, handleUpgradePlan } = useEeConfig()

const { wsTabVisibility, hasAdminTabBar } = useWorkspaceTabVisibility(activeWorkspace)

// Tab definitions
interface TabItem {
  key: string
  icon: string
  label: string
  upgradeBadge?: { feature: PlanFeatureTypes; blocked: boolean }
  hidden?: boolean
}

const tabItems = computed<TabItem[]>(() => {
  return [
    { key: 'settings', icon: 'ncSettings', label: t('general.general'), hidden: !wsTabVisibility.value.settings },
    {
      key: 'billing',
      icon: 'ncDollarSign',
      label: t('general.billing'),
      hidden: !wsTabVisibility.value.billing,
    },
    {
      key: 'audits',
      icon: 'audit',
      label: t('title.audits'),
      upgradeBadge: { feature: PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE, blocked: !isWsAuditEnabled.value },
      hidden: !wsTabVisibility.value.audits,
    },
    {
      key: 'sso',
      icon: 'sso',
      label: t('title.sso'),
      hidden: !wsTabVisibility.value.sso,
    },
  ].filter((item) => !item.hidden)
})

const activeTab = computed({
  get() {
    return routeNameToWsTab[route.value.name as string] || 'settings'
  },
  set(tabKey: string) {
    if (!isWsAuditEnabled.value && tabKey === 'audits') {
      handleUpgradePlan({
        title: t('upgrade.upgradeToAccessWsAudit'),
        content: t('upgrade.upgradeToAccessWsAuditSubtitle', { plan: PlanTitles.ENTERPRISE }),
        limitOrFeature: PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE,
        triggerSource: 'ws-admin-tabs-audit',
      })
      return
    }

    const typeOrId = route.value.params.typeOrId || activeWorkspaceId.value || 'nc'
    router.push({ name: wsTabToRouteName[tabKey] || 'index-typeOrId-settings', params: { typeOrId } })
  },
})
</script>

<template>
  <NcTabs v-if="hasAdminTabBar" :key="`${tabItems.length}`" v-model:active-key="activeTab" class="nc-ws-admin-tabs">
    <template #leftExtra>
      <div class="w-2 sm:w-4"></div>
    </template>

    <a-tab-pane v-for="item in tabItems" :key="item.key">
      <template #tab>
        <div class="tab-title">
          <GeneralIcon :icon="item.icon" class="h-4 w-4" />
          {{ item.label }}
          <LazyPaymentUpgradeBadge
            v-if="item.upgradeBadge"
            :feature="item.upgradeBadge.feature"
            :feature-enabled-callback="() => !item.upgradeBadge!.blocked"
            remove-click
            icon-only
          />
        </div>
      </template>
    </a-tab-pane>
  </NcTabs>
</template>

<style lang="scss" scoped>
.nc-ws-admin-tabs {
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
