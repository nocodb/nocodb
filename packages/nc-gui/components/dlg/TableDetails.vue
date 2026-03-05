<script setup lang="ts">
import { PlanFeatureTypes } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'

interface Props {
  modelValue: boolean
  initialTab?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialTab: 'field',
})

const emits = defineEmits(['update:modelValue'])

const visible = useVModel(props, 'modelValue', emits)

const { isSqlView } = useSmartsheetStoreOrThrow()

const { $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const { blockTableAndFieldPermissions, showUpgradeToUseTableAndFieldPermissions, isEEFeatureBlocked } = useEeConfig()

const { base } = storeToRefs(useBase())

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { hasV2Webhooks } = storeToRefs(useWebhooksStore())

const activeTab = ref(props.initialTab)

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '2rem',
  },
  spin: true,
})

const shouldShowTab = computed(() => {
  return {
    field: isUIAllowed('fieldAdd') && !isSqlView.value,
    permissions: isEeUI && isUIAllowed('fieldAdd') && !isSqlView.value,
    webhook: isUIAllowed('hookList') && !isSqlView.value,
  }
})

watch(activeTab, (val) => {
  if (val === 'permissions' && showUpgradeToUseTableAndFieldPermissions()) {
    activeTab.value = 'relation'
    return
  }

  $e(`c:table:modal-tab-open:${val}`)
})

watch(
  () => props.initialTab,
  (val) => {
    if (val) activeTab.value = val
  },
)
</script>

<template>
  <NcModal v-model:visible="visible" size="lg" :body-style="{ padding: 0 }" wrap-class-name="nc-table-details-modal">
    <div class="flex flex-col h-[min(80vh,864px)]">
      <NcTabs v-model:active-key="activeTab" centered class="nc-table-details-tabs flex-1">
        <a-tab-pane v-if="shouldShowTab.field" key="field">
          <template #tab>
            <div class="tab" data-testid="nc-modal-fields-tab">
              <GeneralIcon icon="ncList" class="tab-icon" />
              <div>{{ $t('objects.fields') }}</div>
            </div>
          </template>
          <LazySmartsheetDetailsFields />
        </a-tab-pane>

        <a-tab-pane v-if="shouldShowTab.permissions" key="permissions">
          <template #tab>
            <div class="tab" data-testid="nc-modal-permissions-tab">
              <GeneralIcon icon="ncLock" class="tab-icon" />
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
            style="height: calc(80vh - 80px)"
          />
        </a-tab-pane>

        <a-tab-pane key="relation">
          <template #tab>
            <div class="tab" data-testid="nc-modal-relations-tab">
              <GeneralIcon icon="ncErd" class="tab-icon" />
              <div>{{ $t('title.relations') }}</div>
            </div>
          </template>
          <LazySmartsheetDetailsErd />
        </a-tab-pane>

        <a-tab-pane key="api">
          <template #tab>
            <div class="tab" data-testid="nc-modal-apis-tab">
              <GeneralIcon icon="ncCode" class="tab-icon" />
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
            <div class="tab" data-testid="nc-modal-webhooks-tab">
              <GeneralIcon icon="ncWebhook" class="tab-icon" />
              <div>{{ $t('objects.webhooks') }}</div>
              <GeneralIcon v-if="hasV2Webhooks" icon="alertTriangleSolid" class="text-nc-content-orange-medium h-4 w-4" />
            </div>
          </template>
          <LazySmartsheetDetailsWebhooks />
        </a-tab-pane>
      </NcTabs>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.tab {
  @apply flex flex-row items-center gap-x-1.5 pr-0.5;
}
</style>

<style lang="scss">
.nc-table-details-modal .nc-table-details-tabs {
  @apply h-full;

  > .ant-tabs-nav:first-of-type {
    @apply px-3;
    min-height: 48px;

    .ant-tabs-tab {
      @apply pt-3 pb-3 text-small leading-[18px];
    }

    .ant-tabs-nav-wrap {
      @apply mx-auto;
    }
  }

  > .ant-tabs-content-holder {
    @apply overflow-auto;
  }
}
</style>
