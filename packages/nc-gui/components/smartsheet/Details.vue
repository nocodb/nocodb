<script setup lang="ts">
import { LoadingOutlined } from '@ant-design/icons-vue'

const { openedViewsTab } = storeToRefs(useViewsStore())
const { onViewsTabChange } = useViewsStore()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isSqlView } = useSmartsheetStoreOrThrow()

const { $e } = useNuxtApp()

const { isUIAllowed, isBaseRolesLoaded } = useRoles()

const { base } = storeToRefs(useBase())
const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '2rem',
  },
  spin: true,
})

const openedSubTab = computed({
  get() {
    return openedViewsTab.value
  },
  set(val) {
    onViewsTabChange(val)
  },
})

watch(
  [openedSubTab, isBaseRolesLoaded],
  () => {
    // Re-enable this check for first render
    if (
      // check page access only after base roles are loaded
      isBaseRolesLoaded.value &&
      ((openedSubTab.value === 'field' && !isUIAllowed('fieldAdd')) ||
        (openedSubTab.value === 'webhook' && !isUIAllowed('hookList')) ||
        (['field', 'webhook'].includes(openedSubTab.value) && isSqlView.value))
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
    <NcTabs v-model:activeKey="openedSubTab" centered class="nc-details-tab">
      <a-tab-pane v-if="isUIAllowed('fieldAdd') && !isSqlView" key="field">
        <template #tab>
          <div class="tab" data-testid="nc-fields-tab">
            <GeneralIcon icon="ncList" class="tab-icon" :class="{}" />
            <div>{{ $t('objects.fields') }}</div>
          </div>
        </template>
        <LazySmartsheetDetailsFields />
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

      <a-tab-pane v-if="isUIAllowed('hookList') && !isSqlView" key="webhook">
        <template #tab>
          <div class="tab" data-testid="nc-webhooks-tab">
            <GeneralIcon icon="ncWebhook" class="tab-icon" :class="{}" />
            <div>{{ $t('objects.webhooks') }}</div>
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
