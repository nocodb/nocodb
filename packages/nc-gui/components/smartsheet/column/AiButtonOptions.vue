<script setup lang="ts">
import { UITypes, isCreatedOrLastModifiedByCol, isCreatedOrLastModifiedTimeCol, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { ButtonActionsType, type ButtonType, type ColumnType, type HookType } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value', 'navigateToIntegrations'])

const { t } = useI18n()

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const { formState, isEdit, setAdditionalValidations, validateInfos, column, validate, loadData, formattedData } =
  useColumnCreateStoreOrThrow()

const { aiIntegrationAvailable, aiLoading, aiError } = useNocoAi()

const uiTypesNotSupportedInFormulas = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

const isOpenConfigModal = ref<boolean>(false)

const isOpenSelectOutputFieldDropdown = ref<boolean>(false)

const isOpenSelectRecordDropdown = ref<boolean>(false)

const previewOutput = ref<Record<string, any>>({})

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

const isLoadingViewData = ref(false)

const loadViewData = async () => {
  if (!formattedData.value.length && !isLoadingViewData.value) {
    isLoadingViewData.value = true

    await loadData()

    isLoadingViewData.value = false
  }
}

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv) ?? null)

const sampleRecords = computed<
  {
    label: any
    value: any
  }[]
>(() => {
  return (formattedData.value || [])
    .map((row) => {
      const pk = extractPkFromRow(unref(row.row), meta.value?.columns || [])

      const displayValue = row.row?.[displayField.value?.title]

      return {
        label: displayValue,
        value: pk,
      }
    })
    .filter((r) => !!(r.label && r.value))
})

const selectedRecordPk = ref('')

const selectedRecordDisplayValue = computed(() => {
  return sampleRecords.value.find((r) => r.value === selectedRecordPk.value)?.label
})

// AI options
const availableFields = computed(() => {
  if (!meta.value?.columns) return []
  return meta.value.columns.filter(
    (c) => c.title && !c.system && c.uidt !== UITypes.ID && (isEdit.value ? column.value?.id !== c.id : true),
  )
})

const inputColumns = computed(() => {
  return availableFields.value.filter((f) => {
    return vModel.value.formula_raw?.includes(`{${f.title}}`)
  })
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

  if (isOpenSelectRecordDropdown.value) {
    isOpenSelectRecordDropdown.value = false
  }
}

watch(isOpenConfigModal, (isOpen) => {
  if (!isOpen) {
    isOpenSelectOutputFieldDropdown.value = false
  }
})

const isReadOnlyVirtualCell = (column: ColumnType) => {
  return (
    isRollup(column) ||
    isFormula(column) ||
    isBarcode(column) ||
    isLookup(column) ||
    isQrCode(column) ||
    isSystemColumn(column) ||
    isCreatedOrLastModifiedTimeCol(column) ||
    isCreatedOrLastModifiedByCol(column)
  )
}

// provide the following to override the default behavior and enable input fields like in form
provide(ActiveCellInj, ref(true))
provide(IsFormInj, ref(true))
</script>

<template>
  <div class="relative flex flex-col gap-4">
    <template v-if="!aiIntegrationAvailable">
      <div v-if="!aiIntegrationAvailable" class="py-2 pl-3 pr-2 flex items-center gap-2 bg-nc-bg-orange-light rounded-lg">
        <GeneralIcon icon="alertTriangleSolid" class="!text-nc-content-orange-medium w-4 h-4" />
        <div class="text-sm text-nc-content-gray-subtle flex-1">No AI Integrations added.</div>

        <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="emit('navigateToIntegrations')">
          Add integration
        </NcButton>
      </div>
    </template>

    <template v-else-if="!!aiError"> </template>
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

        <div class="h-[calc(100%_-_57px)]">
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

                <a-form-item v-bind="validateInfos.output_column_ids" class="!my-0">
                  <div class="flex items-center">
                    <span class="flex-1"> Select fields to generate data </span>

                    <NcDropdown v-model:visible="isOpenSelectOutputFieldDropdown" placement="bottomRight">
                      <NcButton size="small" type="text" @click.stop class="!hover:text-nc-content-brand">
                        <div class="flex items-center gap-2">
                          <GeneralIcon icon="plus" class="!text-current" />
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
                <a-form-item class="!my-0">
                  <div class="mb-2 text-sm text-nc-content-gray-subtle2">Select sample record</div>
                  <div class="flex items-center rounded-lg border-1 border-purple-200">
                    <NcDropdown
                      v-model:visible="isOpenSelectRecordDropdown"
                      placement="bottomLeft"
                      overlay-class-name="!min-w-64"
                    >
                      <div class="flex-1 flex items-center gap-2 px-2 cursor-pointer" @click.stop="loadViewData">
                        <NcTooltip
                          v-if="selectedRecordDisplayValue"
                          class="truncate flex-1"
                          show-on-truncate-only
                          :disabled="isOpenSelectRecordDropdown"
                        >
                          <template #title>
                            <LazySmartsheetPlainCell v-model="selectedRecordDisplayValue" :column="displayField" />
                          </template>
                          <LazySmartsheetPlainCell v-model="selectedRecordDisplayValue" :column="displayField" />
                        </NcTooltip>

                        <div v-else class="flex-1 text-nc-content-gray-subtle2">- Select record -</div>
                        <GeneralIcon
                          icon="chevronDown"
                          class="flex-none"
                          :class="{
                            'transform rotate-180': isOpenSelectRecordDropdown,
                          }"
                        />
                      </div>

                      <template #overlay>
                        <div
                          v-if="isLoadingViewData"
                          class="w-full relative flex flex-col items-center justify-center gap-2 min-h-25 text-nc-content-brand"
                        >
                          <GeneralLoader size="large" class="flex-none" />
                          Loading records
                        </div>
                        <NcList
                          v-else
                          v-model:value="selectedRecordPk"
                          v-model:open="isOpenSelectRecordDropdown"
                          :list="sampleRecords"
                        >
                          <template #listItem="{ option, isSelected }">
                            <div class="inline-flex items-center gap-2 flex-1 truncate">
                              <NcTooltip class="truncate flex-1" show-on-truncate-only>
                                <template #title>
                                  <div>
                                    <LazySmartsheetPlainCell v-model="option.label" :column="displayField" />
                                  </div>
                                </template>
                                <LazySmartsheetPlainCell v-model="option.label" :column="displayField" />
                              </NcTooltip>

                              <GeneralIcon
                                v-if="isSelected()"
                                id="nc-selected-item-icon"
                                icon="check"
                                class="flex-none text-primary w-4 h-4"
                              />
                            </div>
                          </template>
                        </NcList>
                      </template>
                    </NcDropdown>
                    <NcButton size="small" type="secondary" class="nc-ai-button-test-generate" :disabled="aiLoading">
                      <div class="flex items-center gap-2">
                        <GeneralIcon icon="ncAutoAwesome" class="text-nc-content-yellow-medium h-4 w-4" />

                        Test Generate
                      </div>
                    </NcButton>
                  </div>
                </a-form-item>
              </div>
              <div class="nc-ai-button-config-right-section">
                <div class="text-sm text-nc-content-gray-subtle2 font-bold flex items-center gap-2.5">
                  Input fields
                  <a-tag v-if="inputColumns.length" class="!rounded-md !bg-nc-bg-brand !text-nc-content-brand !border-none !mx-0">
                    {{ inputColumns.length }}</a-tag
                  >

                  <GeneralIcon icon="arrowRight" />
                </div>
                <template v-for="field in inputColumns">
                  <a-form-item
                    v-if="field.title"
                    :key="field.id"
                    :name="field.title"
                    class="!my-0 nc-input-required-error"
                  >
                    <div class="flex items-center gap-2 text-nc-content-gray-subtle2 mb-2">
                      <component :is="cellIcon(field)" class="!mx-0" />
                      <NcTooltip class="truncate flex-1" show-on-truncate-only>
                        <template #title>
                          {{ field?.title }}
                        </template>
                        {{ field?.title }}
                      </NcTooltip>
                    </div>

                    <LazySmartsheetDivDataCell
                      class="relative min-h-[37px] flex items-center"
                      :class="{
                        '!select-text nc-system-field': isReadOnlyVirtualCell(field),
                        '!select-text nc-readonly-div-data-cell': !isReadOnlyVirtualCell(field),
                      }"
                    >
                      <LazySmartsheetVirtualCell
                        v-if="isVirtualCol(field)"
                        :model-value="previewOutput[field.title]"
                        class="mt-0 nc-input nc-cell"
                        :class="[`nc-form-input-${field.title?.replaceAll(' ', '')}`, { readonly: field?.read_only }]"
                        :column="field"
                        :read-only="true"
                      />

                      <LazySmartsheetCell
                        v-else
                        v-model="previewOutput[field.title]"
                        class="nc-input truncate"
                        :class="[`nc-form-input-${field.title?.replaceAll(' ', '')}`, { readonly: field?.read_only }]"
                        :column="field"
                        :edit-enabled="true"
                        :read-only="true"
                      />
                    </LazySmartsheetDivDataCell>
                  </a-form-item>
                </template>
              </div>
              <div class="nc-ai-button-config-right-section">
                <div class="text-sm text-nc-content-gray-subtle2 font-bold flex items-center gap-2.5">
                  Output fields
                  <a-tag
                    v-if="outputColumnIds.length"
                    class="!rounded-md !bg-nc-bg-brand !text-nc-content-brand !border-none !mx-0"
                  >
                    {{ outputColumnIds.length }}</a-tag
                  >
                </div>
                <template v-for="field in outputFieldOptions">
                  <a-form-item
                    v-if="field.title && outputColumnIds.includes(field.id)"
                    :key="field.id"
                    :name="field.title"
                    class="!my-0 nc-input-required-error"
                  >
                    <div class="flex items-center gap-2 text-nc-content-gray-subtle2 mb-2">
                      <component :is="cellIcon(field)" class="!mx-0" />
                      <NcTooltip class="truncate flex-1" show-on-truncate-only>
                        <template #title>
                          {{ field?.title }}
                        </template>
                        {{ field?.title }}
                      </NcTooltip>
                    </div>

                    <LazySmartsheetDivDataCell
                      class="relative min-h-[37px] flex items-center"
                      :class="{
                        '!select-text nc-system-field': isReadOnlyVirtualCell(field),
                        '!select-text nc-readonly-div-data-cell': !isReadOnlyVirtualCell(field),
                      }"
                    >
                      <LazySmartsheetVirtualCell
                        v-if="isVirtualCol(field)"
                        :model-value="previewOutput[field.title]"
                        class="mt-0 nc-input nc-cell"
                        :class="[`nc-form-input-${field.title?.replaceAll(' ', '')}`, { readonly: field?.read_only }]"
                        :column="field"
                        :read-only="true"
                      />

                      <LazySmartsheetCell
                        v-else
                        v-model="previewOutput[field.title]"
                        class="nc-input truncate"
                        :class="[`nc-form-input-${field.title?.replaceAll(' ', '')}`, { readonly: field?.read_only }]"
                        :column="field"
                        :edit-enabled="true"
                        :read-only="true"
                      />
                    </LazySmartsheetDivDataCell>
                  </a-form-item>
                </template>
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

<style lang="scss">
.nc-ai-button-config-modal-wrapper {
  @apply !z-1050;
}
</style>

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
  @apply mx-auto p-4 w-full max-w-[576px] flex flex-col gap-4;
}

.nc-ai-button-output-field {
  @apply cursor-pointer !rounded-md !bg-nc-bg-brand hover:!bg-brand-100 !text-nc-content-brand !border-none !mx-0;
}

.nc-ai-button-test-generate {
  @apply !rounded-l-none -m-[1px] border-purple-200 !bg-nc-bg-purple-light !text-nc-content-purple-dark hover:(!bg-nc-bg-purple-dark);

  &:disabled {
    @apply !text-nc-content-purple-light !hover:(text-nc-content-purple-light bg-nc-bg-purple-light);
  }
}

:deep(.ant-select-selector) {
  @apply !xs:(h-full);
}

.nc-data-cell {
  @apply !rounded-lg;
  transition: all 0.3s;

  &:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-attachment-cell):not(.nc-virtual-cell-button):not(
      :has(.nc-cell-ai-button)
    ) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }
  &:not(:focus-within):hover:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-virtual-cell-button):not(
      :has(.nc-cell-ai-button)
    ) {
    @apply !border-1;
    &:not(.nc-attachment-cell):not(.nc-virtual-cell-button):not(:has(.nc-cell-ai-button)) {
      box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
    }
  }

  &.nc-readonly-div-data-cell,
  &.nc-system-field {
    @apply !border-gray-200;

    .nc-cell,
    .nc-virtual-cell {
      @apply text-gray-400;
    }
  }
  &.nc-readonly-div-data-cell:focus-within,
  &.nc-system-field:focus-within {
    @apply !border-gray-200;
  }

  &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
    @apply !shadow-selected;
  }

  &:has(.nc-virtual-cell-qrcode .nc-qrcode-container),
  &:has(.nc-virtual-cell-barcode .nc-barcode-container) {
    @apply !border-none px-0 !rounded-none;
    :deep(.nc-virtual-cell-qrcode),
    :deep(.nc-virtual-cell-barcode) {
      @apply px-0;
      & > div {
        @apply !px-0;
      }
      .barcode-wrapper {
        @apply ml-0;
      }
    }
    :deep(.nc-virtual-cell-qrcode) {
      img {
        @apply !h-[84px] border-1 border-solid border-gray-200 rounded;
      }
    }
    :deep(.nc-virtual-cell-barcode) {
      .nc-barcode-container {
        @apply border-1 rounded-lg border-gray-200 h-[64px] max-w-full p-2;
        svg {
          @apply !h-full;
        }
      }
    }
  }
}
.nc-data-cell:focus-within {
  @apply !border-1 !border-brand-500;
}

:deep(.nc-system-field input) {
  @apply bg-transparent;
}
:deep(.nc-data-cell .nc-cell .nc-cell-field) {
  @apply px-2;
}
:deep(.nc-data-cell .nc-virtual-cell .nc-cell-field) {
  @apply px-2;
}
:deep(.nc-data-cell .nc-cell-field.nc-lookup-cell .nc-cell-field) {
  @apply px-0;
}
</style>
