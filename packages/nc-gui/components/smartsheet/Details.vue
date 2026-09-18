<script setup lang="ts">
import { PlanFeatureTypes } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'

const { openedViewsTab } = storeToRefs(useViewsStore())
const { onViewsTabChange } = useViewsStore()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isSqlView } = useSmartsheetStoreOrThrow()

const { $e } = useNuxtApp()

const { t } = useI18n()

const { isUIAllowed, isBaseRolesLoaded } = useRoles()

const { blockTableAndFieldPermissions, showUpgradeToUseTableAndFieldPermissions, isEEFeatureBlocked, showEEFeatures } =
  useEeConfig()

const { base } = storeToRefs(useBase())
const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())

const { hasV2Webhooks } = storeToRefs(useWebhooksStore())

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '2rem',
  },
  spin: true,
})

const shouldShowTab = computed(() => {
  return {
    field: isUIAllowed('fieldAdd') && !isSqlView.value,
    permissions: isEeUI && isUIAllowed('fieldAdd') && !isSqlView.value && showEEFeatures.value,
    webhook: isUIAllowed('hookList') && !isSqlView.value,
  }
})

// Label for the back-to-data header. The Data | Details toggle was removed, so
// this surface is reached via the 3-dot menu (Fields) or a deep link.
const sectionTitle = computed(() => {
  switch (openedViewsTab.value) {
    case 'permissions':
      return t('general.permissions')
    case 'relation':
      return t('title.relations')
    case 'api':
      return t('labels.apiSnippet')
    case 'webhook':
      return t('objects.webhooks')
    case 'field':
    default:
      return t('objects.fields')
  }
})

const openedSubTab = computed({
  get() {
    return openedViewsTab.value
  },
  set(val) {
    if (
      val === 'permissions' &&
      showUpgradeToUseTableAndFieldPermissions({ triggerSource: 'table-details-table-field-permissions' })
    ) {
      return
    }

    onViewsTabChange(val)
  },
})

watch(
  [openedSubTab, isBaseRolesLoaded],
  () => {
    // Re-enable this check for first render

    const fieldTabCondition = openedSubTab.value !== 'field' || shouldShowTab.value.field
    const permissionsTabCondition =
      openedSubTab.value !== 'permissions' || (shouldShowTab.value.permissions && !blockTableAndFieldPermissions.value)
    const webhookTabCondition = openedSubTab.value !== 'webhook' || shouldShowTab.value.webhook

    if (
      // check page access only after base roles are loaded
      isBaseRolesLoaded.value &&
      (!fieldTabCondition || !webhookTabCondition || !permissionsTabCondition)
    ) {
      onViewsTabChange('relation')
    }

    $e(`c:table:tab-open:${openedSubTab.value}`)
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div
    class="flex flex-col h-full w-full"
    data-testid="nc-details-wrapper"
    :class="{
      'nc-details-tab-left-sidebar-close': !isLeftSidebarOpen,
    }"
  >
    <div
      class="flex items-center gap-2 px-3 border-b-1 border-nc-border-gray-medium h-[var(--toolbar-height)] min-h-[var(--toolbar-height)]"
    >
      <NcButton
        v-e="['c:project:mode:data']"
        size="small"
        type="secondary"
        data-testid="nc-details-back-to-data"
        @click="onViewsTabChange('view')"
      >
        <div class="flex items-center gap-1.5">
          <GeneralIcon icon="ncArrowLeft" class="h-4 w-4" />
          {{ $t('general.data') }}
        </div>
      </NcButton>
      <span class="text-nc-content-gray-muted">/</span>
      <div class="text-bodyDefaultSm font-semibold text-nc-content-gray">{{ sectionTitle }}</div>
    </div>
    <NcTabs v-model:active-key="openedSubTab" centered class="nc-details-tab flex-1 min-h-0">
      <a-tab-pane v-if="shouldShowTab.field" key="field">
        <template #tab>
          <div class="tab" data-testid="nc-fields-tab">
            <GeneralIcon icon="ncList" class="tab-icon" :class="{}" />
            <div>{{ $t('objects.fields') }}</div>
          </div>
        </template>
        <LazySmartsheetDetailsFields />
      </a-tab-pane>
      <a-tab-pane v-if="shouldShowTab.permissions" key="permissions">
        <template #tab>
          <div class="tab" data-testid="nc-permissions-tab">
            <GeneralIcon icon="ncLock" class="tab-icon" :class="{}" />
            <div>{{ $t('general.permissions') }}</div>
            <LazyPaymentUpgradeBadge
              :feature="PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS"
              :feature-enabled-callback="() => !isEEFeatureBlocked"
              remove-click
            />
          </div>
        </template>

        <PermissionsModalContent
          v-if="meta?.id"
          :table-id="meta.id"
          class="!px-4 !pb-4"
          permissions-table-wrapper-class="max-w-250"
          permissions-field-wrapper-class="max-w-250 !top-4"
          permissions-table-toolbar-class-name="pt-4"
          style="height: calc(100vh - (var(--topbar-height) * 2))"
        />
      </a-tab-pane>
      <a-tab-pane key="relation">
        <template #tab>
          <div class="tab" data-testid="nc-relations-tab">
            <GeneralIcon icon="ncErd" class="tab-icon" :class="{}" />
            <div>{{ $t('title.relations') }}</div>
          </div>
        </template>
        <LazySmartsheetDetailsErd />
      </a-tab-pane>

      <a-tab-pane key="api">
        <template #tab>
          <div class="tab" data-testid="nc-apis-tab">
            <GeneralIcon icon="ncCode" class="tab-icon" :class="{}" />
            <div>{{ $t('labels.apiSnippet') }}</div>
          </div>
        </template>
        <LazySmartsheetDetailsApi v-if="base && meta && view" />
        <div v-else class="h-full w-full flex flex-col justify-center items-center mt-28 mb-4">
          <a-spin size="large" :indicator="indicator" />
        </div>
      </a-tab-pane>

      <a-tab-pane v-if="shouldShowTab.webhook" key="webhook">
        <template #tab>
          <div class="tab" data-testid="nc-webhooks-tab">
            <GeneralIcon icon="ncWebhook" class="tab-icon" />
            <div>{{ $t('objects.webhooks') }}</div>
            <GeneralIcon v-if="hasV2Webhooks" icon="alertTriangleSolid" class="text-nc-content-orange-medium h-4 w-4" />
          </div>
        </template>
        <LazySmartsheetDetailsWebhooks />
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style lang="scss" scoped>
.tab {
  @apply flex flex-row items-center gap-x-1.5 pr-0.5;
}

// The centered tab strip is hidden — section navigation now happens from the
// view 3-dot menu, and the back-to-data header replaces the old toggle.
:deep(.nc-details-tab > .ant-tabs-nav:first-of-type) {
  @apply hidden;
}
</style>

<style lang="scss">
.nc-details-tab.nc-tabs.centered {
  > .ant-tabs-nav {
    @apply px-3;
    .ant-tabs-nav-wrap {
      @apply absolute mx-auto;
    }
  }
}

.nc-details-tab-left-sidebar-close > .nc-details-tab.nc-tabs.centered {
  > .ant-tabs-nav {
    @apply px-3;
    .ant-tabs-nav-wrap {
      @apply absolute mx-auto;
    }
  }
}
</style>
