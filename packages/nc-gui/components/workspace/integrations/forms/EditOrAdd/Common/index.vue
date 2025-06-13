<script lang="ts" setup>
import { type IntegrationCategoryType, SyncDataType, type clientTypes as _clientTypes } from '#imports'

const props = defineProps<{
  open: boolean
  integrationType: IntegrationCategoryType
  integrationSubType: SyncDataType
}>()

const emit = defineEmits(['update:open'])

const vOpen = useVModel(props, 'open', emit)

const {
  pageMode,
  IntegrationsPageMode,
  activeIntegration,
  activeIntegrationItem,
  saveIntegration,
  updateIntegration,
  testConnection,
} = useIntegrationStore()

const isEditMode = computed(() => pageMode.value === IntegrationsPageMode.EDIT)

const testConnectionResult = ref<{ success: boolean; message?: string } | null>(null)

const testConnectionLoading = ref(false)

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
  onChange: () => {
    testConnectionResult.value = null
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

const onTestConnection = async () => {
  testConnectionLoading.value = true

  testConnectionResult.value = (await testConnection(formState.value)) || null

  testConnectionLoading.value = false
}
</script>

<template>
  <WorkspaceIntegrationsFormsEditOrAddCommonWrapper
    v-if="activeIntegration && activeIntegrationItem?.dynamic"
    v-bind="props"
    @update:open="vOpen = $event"
  >
    <template #headerRight>
      <NcButton
        v-if="activeIntegrationItem.type === 'auth'"
        size="small"
        :type="!testConnectionResult?.success ? 'primary' : 'ghost'"
        :disabled="testConnectionLoading"
        :loading="testConnectionLoading"
        class="nc-extdb-btn-test-connection"
        @click="onTestConnection"
      >
        <div class="flex items-center gap-2">
          <GeneralIcon
            v-if="testConnectionResult?.success === true"
            icon="circleCheckSolid"
            class="text-success w-4 h-4 bg-white-500"
          />
          <NcTooltip v-if="testConnectionResult?.success === false" placement="top">
            <template #title>{{ testConnectionResult?.message }}</template>
            <GeneralIcon icon="alertTriangleSolid" class="text-warning w-4 h-4 bg-white-500" />
          </NcTooltip>
          Test connection
        </div>
      </NcButton>
      <NcButton
        size="small"
        type="primary"
        :disabled="isLoading || (!testConnectionResult?.success && activeIntegrationItem.type === 'auth')"
        :loading="isLoading"
        class="nc-extdb-btn-submit"
        @click="submit"
      >
        {{ pageMode === IntegrationsPageMode.ADD ? 'Create integration' : 'Update integration' }}
      </NcButton>
    </template>
    <template #leftPanel="{ class: leftPanelClass }">
      <div :class="leftPanelClass">
        <NcFormBuilder class="px-2" />
        <WorkspaceIntegrationsSyncPanel v-if="activeIntegrationItem.type === 'sync'" class="px-2" />
        <div class="mt-10"></div>
      </div>
    </template>
  </WorkspaceIntegrationsFormsEditOrAddCommonWrapper>
  <WorkspaceIntegrationsConnect
    v-if="activeIntegration && activeIntegration.sub_type === SyncDataType.NOCODB"
    v-bind="props"
    @update:open="vOpen = $event"
  />
  <div v-else></div>
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
