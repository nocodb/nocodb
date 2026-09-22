<script lang="ts" setup>
/**
 * Data Permissions — tables/fields and docs behind one nav item.
 *
 * The two tabs sit on different plans (tables & fields on Plus, docs on
 * Business), so the upgrade card lives inside each tab rather than replacing
 * the page: one tab can be usable while the other is not.
 */
import { PlanFeatureTypes } from 'nocodb-sdk'

interface Props {
  baseId: string
  /** Which tab to open on — lets /settings/docs-permissions keep working. */
  initialTab?: 'tables' | 'docs'
}

const props = withDefaults(defineProps<Props>(), { initialTab: 'tables' })

const baseSettingsState = defineModel<string>('state')

const { blockTableAndFieldPermissions, blockDocumentPermissions } = useEeConfig()

const activeTab = ref<'tables' | 'docs'>(props.initialTab)

watch(
  () => props.initialTab,
  (tab) => {
    activeTab.value = tab
  },
)
</script>

<template>
  <div class="flex flex-col h-full">
    <NcTabs v-model:active-key="activeTab" class="nc-data-permissions-tabs">
      <a-tab-pane key="tables" class="!h-full">
        <template #tab>
          <div v-e="['c:settings:base:permissions:tables']" class="flex gap-2 items-center">
            <GeneralIcon icon="ncLock" class="h-4 w-4" />
            <span>{{ $t('labels.baseNav.dataPermissions') }}</span>
          </div>
        </template>
        <PaymentUpgradeFeatureCard
          v-if="blockTableAndFieldPermissions"
          :feature="PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS"
          :title="$t('labels.baseNav.upgradeTitlePermissionsTablesFields')"
          :detail="$t('labels.baseNav.upgradeDescPermissionsTablesFields')"
          icon="ncLock"
        />
        <DashboardSettingsPermissions v-else v-model:state="baseSettingsState" :base-id="baseId" />
      </a-tab-pane>

      <a-tab-pane key="docs" class="!h-full">
        <template #tab>
          <div v-e="['c:settings:base:permissions:docs']" class="flex gap-2 items-center">
            <GeneralIcon icon="ncFileText" class="h-4 w-4" />
            <span>{{ $t('labels.baseNav.docsPermissions') }}</span>
          </div>
        </template>
        <PaymentUpgradeFeatureCard
          v-if="blockDocumentPermissions"
          :feature="PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS"
          :title="$t('labels.baseNav.upgradeTitlePermissionsDocs')"
          :detail="$t('labels.baseNav.upgradeDescPermissionsDocs')"
          icon="ncFileText"
        />
        <DashboardSettingsDocsPermissions
          v-else
          v-model:state="baseSettingsState"
          :base-id="baseId"
          :active="activeTab === 'docs'"
        />
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style lang="scss" scoped>
.nc-data-permissions-tabs {
  @apply h-full;

  // Tabs carry px-2 of their own; px-4 lands the tab text on the header's px-6 edge.
  :deep(.ant-tabs-nav) {
    @apply px-4 mb-0;
  }

  :deep(.ant-tabs-content-holder) {
    @apply h-full overflow-hidden;
  }
}
</style>
