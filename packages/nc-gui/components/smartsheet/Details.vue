<script setup lang="ts">
import { LoadingOutlined } from '@ant-design/icons-vue'

const { openedViewsTab } = storeToRefs(useViewsStore())
const { onViewsTabChange } = useViewsStore()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isSqlView } = useSmartsheetStoreOrThrow()

const { $e } = useNuxtApp()

const { isUIAllowed, isBaseRolesLoaded } = useRoles()

const { blockTableAndFieldPermissions, showUpgradeToUseTableAndFieldPermissions } = useEeConfig()

const { isTableAndFieldPermissionsEnabled } = usePermissions()

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
    permissions: isEeUI && isUIAllowed('fieldAdd') && !isSqlView.value && isTableAndFieldPermissionsEnabled.value,
    webhook: isUIAllowed('hookList') && !isSqlView.value,
  }
})

const openedSubTab = computed({
  get() {
    return openedViewsTab.value
  },
  set(val) {
    if (val === 'permissions' && isTableAndFieldPermissionsEnabled.value && showUpgradeToUseTableAndFieldPermissions()) {
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
    <NcTabs v-model:active-key="openedSubTab" centered class="nc-details-tab">
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

:deep(.nc-details-tab > .ant-tabs-nav:first-of-type) {
  min-height: calc(var(--toolbar-height) - 1px);

  .ant-tabs-tab {
    @apply pt-3 pb-3 text-small leading-[18px];
  }
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
