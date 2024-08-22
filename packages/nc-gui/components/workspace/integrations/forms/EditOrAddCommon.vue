<script lang="ts" setup>
import type { IntegrationCategoryType, SyncDataType } from '#imports'
import { clientTypes as _clientTypes } from '#imports'

const props = defineProps<{
  open: boolean
  integrationType: IntegrationCategoryType
  integrationSubType: SyncDataType
}>()

const emit = defineEmits(['update:open'])

const vOpen = useVModel(props, 'open', emit)

const {
  isFromIntegrationPage,
  pageMode,
  IntegrationsPageMode,
  activeIntegration,
  activeIntegrationItem,
  saveIntegration,
  updateIntegration,
} = useIntegrationStore()

const isEditMode = computed(() => pageMode.value === IntegrationsPageMode.EDIT)

const initState = ref({
  type: props.integrationType,
  sub_type: props.integrationSubType,
})

const { form, formState, isLoading, initialState, submit } = useProvideFormBuilderHelper({
  formSchema: activeIntegrationItem.value?.form,
  initialState: initState,
  onSubmit: async () => {
    // if it is edit mode and activeIntegration id is not present then return
    if (isEditMode.value && !activeIntegration.value?.id) return

    isLoading.value = true

    console.log('formState.value', formState.value)

    try {
      if (pageMode.value === IntegrationsPageMode.ADD) {
        await saveIntegration(formState.value)
      } else {
        await updateIntegration({
          id: activeIntegration.value?.id,
          ...formState.value,
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      isLoading.value = false
    }
  },
})

// select and focus title field on load
onMounted(async () => {
  isLoading.value = true

  if (pageMode.value === IntegrationsPageMode.ADD) {
    formState.value.title = activeIntegration.value?.title || ''
  } else {
    if (!activeIntegration.value) return

    formState.value = {
      title: activeIntegration.value.title || '',
      config: activeIntegration.value.config,
      is_private: !!activeIntegration.value?.is_private,
      ...initState.value,
    }
    initialState.value = JSON.parse(JSON.stringify(formState.value))
  }

  nextTick(() => {
    // todo: replace setTimeout and follow better approach
    setTimeout(() => {
      const input = form.value?.$el?.querySelector('input[type=text]')
      input?.setSelectionRange(0, formState.value.title.length)
      input?.focus()
    }, 500)
  })

  isLoading.value = false
})
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
        <WorkspaceIntegrationsIcon :integration-item="activeIntegrationItem" size="xs" />
        <div class="flex-1 text-base font-weight-700">{{ activeIntegration?.title }}</div>
      </div>
      <div class="flex items-center gap-3">
        <NcButton
          size="small"
          type="primary"
          :disabled="isLoading"
          :loading="isLoading"
          class="nc-extdb-btn-submit"
          @click="submit"
        >
          {{ pageMode === IntegrationsPageMode.ADD ? 'Create integration' : 'Modify integration' }}
        </NcButton>
        <NcButton size="small" type="text" @click="vOpen = false">
          <GeneralIcon icon="close" class="text-gray-600" />
        </NcButton>
      </div>
    </div>

    <div class="h-[calc(100%_-_66px)] flex">
      <div class="nc-edit-or-add-integration-left-panel nc-scrollbar-thin relative">
        <div class="w-full gap-4 max-w-[768px]">
          <div class="nc-edit-or-add-integration bg-white relative flex flex-col justify-center gap-2 w-full">
            <NcFormBuilder />
            <div class="mt-10"></div>
          </div>
        </div>
      </div>
      <div class="nc-edit-or-add-integration-right-panel">
        <WorkspaceIntegrationsSupportedDocs />
        <NcDivider />
      </div>
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
