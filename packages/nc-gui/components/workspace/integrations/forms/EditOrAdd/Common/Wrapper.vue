<script lang="ts" setup>
import { type IntegrationCategoryType, SyncDataType, clientTypes as _clientTypes } from '#imports'

const props = defineProps<{
  open: boolean
  integrationType: IntegrationCategoryType
  integrationSubType: SyncDataType
}>()

const emit = defineEmits(['update:open'])

const vOpen = useVModel(props, 'open', emit)

const { isFromIntegrationPage, pageMode, IntegrationsPageMode, activeIntegration, activeIntegrationItem } = useIntegrationStore()

const isEditMode = computed(() => pageMode.value === IntegrationsPageMode.EDIT)
</script>

<template>
  <div v-if="activeIntegration" class="h-full">
    <div class="p-4 w-full flex items-center justify-between gap-3 border-b-1 border-gray-200">
      <div class="flex-1 flex items-center gap-3">
        <NcButton
          v-if="!isEditMode && !isFromIntegrationPage"
          type="text"
          size="small"
          @click="pageMode = IntegrationsPageMode.LIST"
        >
          <GeneralIcon icon="arrowLeft" />
        </NcButton>
        <div
          v-if="activeIntegrationItem?.sub_type"
          class="bg-nc-bg-gray-light rounded-md h-8 w-8 flex-none flex items-center justify-center children:flex-none"
        >
          <GeneralIntegrationIcon
            :type="activeIntegrationItem.sub_type"
            :size="activeIntegrationItem.sub_type === SyncDataType.NOCODB ? 'lg' : 'sm'"
          />
        </div>
        <div class="flex-1 text-base font-weight-700">{{ activeIntegration?.title }}</div>
      </div>
      <div class="flex items-center gap-3">
        <slot name="headerRightExtra"> </slot>
        <slot name="headerRight"> </slot>
        <NcButton size="small" type="text" @click="vOpen = false">
          <GeneralIcon icon="close" class="text-gray-600" />
        </NcButton>
      </div>
    </div>

    <div class="h-[calc(100%_-_66px)] flex">
      <div class="nc-edit-or-add-integration-left-panel nc-scrollbar-thin relative">
        <div class="w-full gap-4 max-w-[784px]">
          <slot name="leftPanel" class="nc-edit-or-add-integration relative flex flex-col justify-center gap-2 w-full"> </slot>
        </div>
      </div>

      <slot name="rightPanel" class="nc-edit-or-add-integration-right-panel">
        <div v-if="!$slots.rightPanel" class="nc-edit-or-add-integration-right-panel">
          <WorkspaceIntegrationsSupportedDocs />
          <NcDivider />
        </div>
      </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-form-item {
  padding-right: 24px;
  margin-bottom: 12px;
}

:deep(.ant-collapse-header) {
  @apply !-mt-4 !p-0 flex items-center !cursor-default children:first:flex;
}
:deep(.ant-collapse-icon-position-right > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow) {
  @apply !right-0;
}

:deep(.ant-collapse-content-box) {
  @apply !px-0 !pb-0 !pt-3;
}

:deep(.ant-form-item-explain-error) {
  @apply !text-xs;
}

:deep(.ant-divider) {
  @apply m-0;
}

:deep(.ant-form-item-with-help .ant-form-item-explain) {
  @apply !min-h-0;
}

:deep(.ant-select .ant-select-selector .ant-select-selection-item) {
  @apply font-weight-400;
}
</style>

<style lang="scss"></style>
