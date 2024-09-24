<script setup lang="ts">
import { UITypes, isHiddenCol, isVirtualCol } from 'nocodb-sdk'
import { ButtonActionsType, type ButtonType, type ColumnType, type HookType } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const {
  formState,
  isEdit,
  setAdditionalValidations,
  validateInfos,

  column,
  validate,
} = useColumnCreateStoreOrThrow()

const { aiIntegrationAvailable, aiError } = useNocoAi()

const uiTypesNotSupportedInFormulas = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

const webhooksStore = useWebhooksStore()

const { loadHooksList } = webhooksStore

await loadHooksList()

const { hooks } = toRefs(webhooksStore)

const isOpenConfigModal = ref<boolean>(false)

const isOpenSelectOutputFieldDropdown = ref<boolean>(false)

const validators = {
  ...(vModel.value.type === ButtonActionsType.Ai
    ? {
        output_column_ids: [
          {
            required: true,
            message: 'At least one output required for AI Button',
          },
        ],
        formula_raw: [
          {
            required: true,
            message: 'Prompt required for AI Button',
          },
        ],
      }
    : {}),
}

setAdditionalValidations({
  ...validators,
})

const preview = ref('')

// AI options
const availableFields = computed(() => {
  if (!meta.value?.columns) return []
  return meta.value.columns.filter((c) => c.title && !c.system && c.uidt !== UITypes.ID)
})

const outputFieldOptions = computed(() => {
  if (!meta.value?.columns) return []
  return meta.value.columns.filter((c) => !c.system && !c.pk && c.id !== column.value?.id)
})

const outputColumnIds = computed({
  get: () => {
    if (!vModel.value?.output_column_ids?.length) return []
    const colIds = vModel.value.output_column_ids?.split(',') || []
    return colIds
  },
  set: (val) => {
    vModel.value.output_column_ids = val.join(',')
  },
})

const removeFromOutputFieldOptions = (id: string) => {
  outputColumnIds.value = outputColumnIds.value.filter((op) => op !== id)
}

onMounted(() => {
  aiError.value = ''
  if (vModel.value.type === ButtonActionsType.Ai) {
    // set default value
    vModel.value.formula_raw = (column?.value?.colOptions as Record<string, any>)?.formula_raw || ''
    vModel.value.output_column_ids = (column?.value?.colOptions as Record<string, any>)?.output_column_ids || ''
  }
})

const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
  })

const handleCloseDropdown = () => {
  if (isOpenSelectOutputFieldDropdown.value) {
    isOpenSelectOutputFieldDropdown.value = false
  }
}

watch(isOpenConfigModal, (isOpen) => {
  if (!isOpen) {
    isOpenSelectOutputFieldDropdown.value = false
  }
})
</script>

<template>
  <div class="relative flex flex-col gap-4">
    <template v-if="!aiIntegrationAvailable">
      <div v-if="!aiIntegrationAvailable" class="py-2 pl-3 pr-2 flex items-center gap-2 bg-nc-bg-orange-light rounded-lg">
        <GeneralIcon icon="alertTriangleSolid" class="!text-nc-content-orange-medium w-4 h-4" />
        <div class="text-sm text-nc-content-gray-subtle flex-1">No AI Integrations added.</div>

        <NcButton size="small" type="text" class="!text-nc-content-brand"> Add integration </NcButton>
      </div>
    </template>

    <template v-if="!!aiError"> </template>
    <template v-else>
      <NcButton
        type="secondary"
        size="small"
        class="!text-nc-content-purple-dark !bg-nc-bg-purple-light hover:!bg-nc-bg-purple-dark"
        @click.stop="isOpenConfigModal = true"
      >
        <div class="flex items-center justify-center gap-2">
          <GeneralIcon icon="ncSettings" class="text-[14px] !text-current" />
          {{ $t('general.configure') }}
        </div>
      </NcButton>
    </template>

    <NcModal
      v-model:visible="isOpenConfigModal"
      class="nc-ai-button-config-modal"
      :show-separator="false"
      size="lg"
      wrap-class-name="nc-ai-button-config-modal-wrapper"
      nc-modal-class-name="!p-0"
      stop-event-propogation
    >
      <div class="h-full flex flex-col" @click="handleCloseDropdown">
        <div class="w-full px-4 py-3 flex gap-2 border-b-1 border-nc-border-gray-medium">
          <div class="flex-1 flex items-center gap-2">
            <GeneralIcon icon="cellAiButton" class="flex-none h-6 w-6" />

            {{ vModel.title || 'AI Button' }}
          </div>

          <NcButton size="small" type="primary" class="nc-extdb-btn-submit"> Add Field </NcButton>
          <NcButton size="small" type="text" @click="isOpenConfigModal = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>

        <div class="flex-1 h-full">
          <div class="h-full flex">
            <!-- Left side -->
            <div class="h-full w-1/2 nc-scrollbar-thin">
              <a-form
                v-model="formState"
                no-style
                layout="vertical"
                class="nc-ai-button-config-left-section flex flex-col gap-6 h-full"
              >
                <div class="text-base text-nc-content-gray font-bold">
                  {{ $t('labels.configuration') }}
                </div>
                <a-form-item class="!my-0" v-bind="validateInfos.formula_raw">
                  <template #label>
                    <span> Input Prompt </span>
                  </template>
                  <div class="nc-prompt-input-wrapper bg-nc-bg-gray-light rounded-lg w-full">
                    <AiPromptWithFields v-model="vModel.formula_raw" :options="availableFields" />
                    <div class="rounded-b-lg flex items-center gap-2 p-1">
                      <GeneralIcon icon="info" class="!text-nc-content-purple-medium h-4 w-4" />
                      <span class="text-xs text-nc-content-gray-subtle2"
                        >Mention fields using curly braces, e.g.
                        <span class="text-nc-content-purple-dark">{Field name}</span>.</span
                      >
                    </div>
                  </div>
                </a-form-item>

                <a-form-item v-bind="validateInfos.output_column_ids">
                  <div class="flex items-center">
                    <span class="flex-1"> Select fields to generate data </span>

                    <NcDropdown v-model:visible="isOpenSelectOutputFieldDropdown" placement="bottomRight">
                      <NcButton size="small" type="text" @click.stop>
                        <div class="flex items-center gap-2">
                          <GeneralIcon icon="plus" />
                          Select fields
                        </div>
                      </NcButton>

                      <template #overlay>
                        <NcList
                          v-model:value="outputColumnIds"
                          v-model:open="isOpenSelectOutputFieldDropdown"
                          :list="outputFieldOptions"
                          search-input-placeholder="Search"
                          option-label-key="title"
                          option-value-key="id"
                          :close-on-select="false"
                          is-multi-select
                        >
                          <template #listItem="{ option, isSelected }">
                            <div class="inline-flex items-center gap-2 flex-1 truncate">
                              <component :is="cellIcon(option)" class="!mx-0" />
                              <NcTooltip class="truncate flex-1" show-on-truncate-only>
                                <template #title>
                                  {{ option?.title }}
                                </template>
                                {{ option?.title }}
                              </NcTooltip>
                            </div>
                            <NcCheckbox :checked="isSelected()" />
                          </template>
                        </NcList>
                      </template>
                    </NcDropdown>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <template v-for="op in outputFieldOptions">
                      <a-tag v-if="outputColumnIds.includes(op.id)" :key="op.id" class="nc-ai-button-output-field">
                        <div class="flex flex-row items-center gap-1 py-[3px] text-sm">
                          <component :is="cellIcon(op)" class="!mx-0" />
                          <span>{{ op.title }}</span>
                          <div class="flex items-center p-0.5 mt-0.5">
                            <GeneralIcon
                              icon="close"
                              class="h-4 w-4 cursor-pointer opacity-80"
                              @click="removeFromOutputFieldOptions(op.id)"
                            />
                          </div>
                        </div>
                      </a-tag>
                    </template>
                  </div>
                </a-form-item>
              </a-form>
            </div>
            <!-- Right side -->
            <div class="h-full w-1/2 bg-nc-bg-gray-extralight nc-scrollbar-thin">
              <div class="nc-ai-button-config-right-section">
                <div class="text-base text-nc-content-gray font-bold">
                  {{ $t('labels.preview') }}
                </div>
              </div>
            </div>
          </div>
          <!-- Footer  -->
          <div></div>
        </div>
      </div>
    </NcModal>
  </div>
</template>

<style scoped lang="scss">
:deep(.ant-form-item-label > label) {
  @apply !text-sm !text-nc-content-gray flex;

  &.ant-form-item-required:not(.ant-form-item-required-mark-optional)::before {
    @apply content-[''] m-0;
  }
}

.nc-prompt-input-wrapper {
  @apply border-1 border-nc-border-gray-medium;
  box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
}

.nc-ai-button-options-preview {
  @apply rounded-lg border-1 border-nc-border-gray-medium;
  box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
}

.nc-ai-button-config-left-section {
  @apply mx-auto p-6 w-full max-w-[568px];
}
.nc-ai-button-config-right-section {
  @apply mx-auto p-4 w-full max-w-[576px];
}

.nc-ai-button-output-field {
  @apply cursor-pointer !rounded-md !bg-nc-bg-brand hover:!bg-brand-100 !text-nc-content-brand !border-none !mx-0;
}
</style>

<style lang="scss">
.nc-ai-button-config-modal-wrapper {
  @apply !z-1050;
}
</style>
