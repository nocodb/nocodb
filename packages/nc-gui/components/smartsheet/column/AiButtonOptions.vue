<script setup lang="ts">
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import { type ColumnType } from 'nocodb-sdk'
import { generateUniqueColumnName } from '~/helpers/parsers/parserHelpers'

const props = defineProps<{
  value: any
  submitBtnLabel: {
    label: string
    loadingLabel: string
  }
  saving: boolean
}>()

const emit = defineEmits(['update:value', 'navigateToIntegrations', 'onSubmit'])

const vModel = useVModel(props, 'value', emit)

const { submitBtnLabel, saving } = toRefs(props)

const meta = inject(MetaInj, ref())

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const {
  isAiButtonConfigModalOpen,
  isEdit,
  validateInfos,
  column,
  loadData,
  formattedData,
  disableSubmitBtn,
  tableExplorerColumns,
} = useColumnCreateStoreOrThrow()

const { aiIntegrationAvailable, aiLoading, aiError, generateRows } = useNocoAi()

const isOpenConfigModal = ref<boolean>(false)

const isOpenSelectOutputFieldDropdown = ref<boolean>(false)

const isOpenSelectRecordDropdown = ref<boolean>(false)

const fieldTitle = computed(() => {
  return (
    vModel.value.title ||
    generateUniqueColumnName({
      formState: vModel.value,
      tableExplorerColumns: tableExplorerColumns?.value,
      metaColumns: meta.value?.columns || [],
    })
  )
})

const previewOutputRow = ref<Row>({
  row: {},
  oldRow: {},
  rowMeta: {},
})

const generatingPreview = ref(false)

const isAlreadyGenerated = ref(false)

const isLoadingViewData = ref(false)

const loadViewData = async () => {
  if (!formattedData.value.length && !isLoadingViewData.value) {
    isLoadingViewData.value = true

    await loadData(undefined, false)

    await ncDelay(250)

    isLoadingViewData.value = false
  }
}

const displayField = computed(() => meta.value?.columns?.find((c) => c?.pv) ?? null)

const sampleRecords = computed<
  {
    label: any
    value: any
    row: any
  }[]
>(() => {
  return (formattedData.value || [])
    .map((row) => {
      const pk = extractPkFromRow(unref(row.row), meta.value?.columns || [])

      const displayValue = row.row?.[displayField.value?.title]

      return {
        label: displayValue,
        value: pk,
        row,
      }
    })
    .filter((r) => !!(r.label && r.value))
})

const selectedRecordPk = ref('')

const selectedRecord = computed(() => {
  return (
    sampleRecords.value.find((r) => r.value === selectedRecordPk.value) || {
      row: {
        row: {},
        oldRow: {},
        rowMeta: { new: true },
      },
      label: '',
      value: '',
    }
  )
})

// AI options
const availableFields = computed(() => {
  if (!meta.value?.columns) return []
  return meta.value.columns.filter(
    (c) =>
      c.title &&
      !c.system &&
      ![UITypes.ID, UITypes.Button, UITypes.Links].includes(c.uidt) &&
      (isEdit.value ? column.value?.id !== c.id : true),
  )
})

const inputColumns = computed(() => {
  return availableFields.value.filter((f) => {
    return vModel.value.formula_raw?.includes(`{${f.title}}`)
  })
})

const outputFieldOptions = computed(() => {
  if (!meta.value?.columns) return []
  return meta.value.columns.filter(
    (c) =>
      !c.system &&
      !c.pk &&
      c.id !== column.value?.id &&
      ![UITypes.Attachment, UITypes.Button, UITypes.Links].includes(c.uidt) &&
      !isReadOnlyVirtualCell(c),
  )
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

const cellIcon = (column: ColumnType) =>
  h(isVirtualCol(column) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: column,
  })

const generate = async () => {
  if (!selectedRecordPk.value || !outputColumnIds.value.length) return

  generatingPreview.value = true

  const res = await generateRows(
    meta.value.id!,
    {
      title: vModel.value?.title,
      prompt_raw: vModel.value.formula_raw,
      fk_integration_id: vModel.value.fk_integration_id,
      uidt: UITypes.Button,
      output_column_ids: outputColumnIds.value.join(','),
    },
    [selectedRecordPk.value],
    false,
  )

  if (res?.length) {
    previewOutputRow.value.row = res[0]

    isAlreadyGenerated.value = true
  }

  generatingPreview.value = false
}

enum ExpansionPanelKeys {
  input = 'input',
  output = 'output',
}

const expansionPanel = ref<ExpansionPanelKeys[]>([ExpansionPanelKeys.output])

const handleUpdateExpansionPanel = (key: ExpansionPanelKeys) => {
  if (expansionPanel.value.includes(key)) {
    expansionPanel.value = expansionPanel.value.filter((k) => k !== key)
  } else {
    if (key === ExpansionPanelKeys.input && !inputColumns.value.length) {
      return
    }
    expansionPanel.value.push(key)
  }
}

// provide the following to override the default behavior and enable input fields like in form
provide(ActiveCellInj, ref(true))
provide(IsFormInj, ref(true))

watch(isOpenConfigModal, (newValue) => {
  if (newValue) {
    isAiButtonConfigModalOpen.value = true
  } else {
    setTimeout(() => {
      isAiButtonConfigModalOpen.value = false
    }, 500)
  }
})

watch(isOpenSelectRecordDropdown, (newValue) => {
  if (newValue) {
    loadViewData()
  }
})

watch(
  () => inputColumns.value.length,
  (newValue) => {
    if (newValue) return

    handleUpdateExpansionPanel(ExpansionPanelKeys.input)
  },
  {
    immediate: true,
  },
)

const previewPanelDom = ref<HTMLElement>()

const isPreviewPanelOnScrollTop = ref(false)

const checkScrollTopMoreThanZero = () => {
  if (previewPanelDom.value) {
    if (previewPanelDom.value.scrollTop > 0) {
      isPreviewPanelOnScrollTop.value = true
    } else {
      isPreviewPanelOnScrollTop.value = false
    }
  }
  return false
}

watch(
  [() => outputColumnIds.value.length, () => vModel.value.formula_raw?.length],
  () => {
    if (!vModel.value.formula_raw || !outputColumnIds.value.length) {
      disableSubmitBtn.value = true
    } else {
      disableSubmitBtn.value = false
    }
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  aiError.value = ''
  if (!vModel.value.formula_raw || !outputColumnIds.value.length) {
    disableSubmitBtn.value = true
  } else {
    disableSubmitBtn.value = false
  }
})

onBeforeUnmount(() => {
  disableSubmitBtn.value = false
  aiError.value = ''
})
</script>

<template>
  <div class="relative flex flex-col gap-4">
    <AiIntegrationNotFound v-if="!aiIntegrationAvailable" />
    <template v-else-if="!!aiError"> </template>
    <template v-else>
      <NcButton type="secondary" size="small" theme="ai" @click.stop="isOpenConfigModal = true">
        <div class="flex items-center justify-center gap-2">
          <GeneralIcon icon="ncSettings" class="text-[14px] !text-current" />
          {{ $t('labels.configureAiButton') }}
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
    >
      <div class="h-full flex flex-col">
        <div class="w-full px-4 py-3 flex gap-2 border-b-1 border-nc-border-gray-medium">
          <div class="flex-1 flex items-center gap-3 text-xl font-semibold">
            <GeneralIcon icon="cellAiButton" class="flex-none h-6 w-6" />

            {{ fieldTitle }}
          </div>

          <!-- Todo: add docs link -->
          <NcButton size="small" type="secondary" @click.stop="navigateTo('/', { open: navigateToBlankTargetOpenOption })">
            <template #icon>
              <GeneralIcon icon="externalLink" class="text-gray-600" />
            </template>

            {{ $t('activity.goToDocs') }}
          </NcButton>

          <NcButton
            size="small"
            type="primary"
            theme="ai"
            :disabled="disableSubmitBtn || saving"
            :label="submitBtnLabel.label"
            :loading-label="submitBtnLabel.loadingLabel"
            :loading="saving"
            @click.stop="emit('onSubmit')"
          >
            {{ submitBtnLabel.label }}
            <template #loading>
              {{ submitBtnLabel.loadingLabel }}
            </template>
          </NcButton>
          <NcButton size="small" type="text" @click.stop="isOpenConfigModal = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>

        <div class="h-[calc(100%_-_58px)]">
          <div class="h-full flex">
            <!-- Left side -->
            <div class="h-full w-1/2 nc-scrollbar-thin">
              <a-form
                v-model="vModel"
                no-style
                layout="vertical"
                class="nc-ai-button-config-left-section flex flex-col gap-6 h-full"
                @submit.prevent
              >
                <div class="flex items-center">
                  <div class="text-base text-nc-content-gray font-bold flex-1">
                    {{ $t('labels.configuration') }}
                  </div>
                  <div class="-my-1.5">
                    <AiSettings
                      v-model:fk-integration-id="vModel.fk_integration_id"
                      v-model:model="vModel.model"
                      v-model:randomness="vModel.randomness"
                      :workspace-id="activeWorkspaceId"
                      :show-tooltip="false"
                      placement="bottomRight"
                    >
                      <NcButton size="xs" theme="ai" class="!px-1" type="text">
                        <GeneralIcon icon="settings" />
                      </NcButton>
                    </AiSettings>
                  </div>
                </div>

                <a-form-item class="!my-0" v-bind="validateInfos.formula_raw">
                  <template #label>
                    <span> Input Prompt </span>
                  </template>
                  <div class="nc-prompt-input-wrapper bg-nc-bg-gray-light rounded-lg w-full">
                    <AiPromptWithFields
                      v-model="vModel.formula_raw"
                      :options="availableFields"
                      placeholder="Enter prompt here..."
                      prompt-field-tag-class-name="!bg-nc-bg-gray-medium !text-nc-content-gray"
                    />
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
                      <NcButton size="small" type="secondary" @click.stop>
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
                  <div v-if="outputFieldOptions.length" class="flex flex-wrap gap-2 mt-2">
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
            <div
              ref="previewPanelDom"
              class="h-full w-1/2 bg-nc-bg-gray-extralight nc-scrollbar-thin flex flex-col relative"
              @scroll.passive="checkScrollTopMoreThanZero"
            >
              <div
                class="nc-ai-button-config-right-section !pt-6 sticky top-0 bg-nc-bg-gray-extralight z-10"
                :class="{
                  'border-b-1 border-nc-border-gray-medium': isPreviewPanelOnScrollTop,
                }"
              >
                <div class="text-base text-nc-content-gray font-bold">
                  {{ $t('labels.preview') }}
                </div>
                <a-form-item class="!mb-0 !mt-2">
                  <div class="mb-2 text-sm text-nc-content-gray-subtle2">Select sample record</div>
                  <div class="flex items-center relative rounded-lg border-1 border-purple-200 bg-purple-50 h-8">
                    <NcDropdown
                      v-model:visible="isOpenSelectRecordDropdown"
                      placement="bottomLeft"
                      overlay-class-name="!min-w-64"
                    >
                      <div
                        class="absolute left-0 top-0 flex-1 flex items-center gap-2 px-2 cursor-pointer h-8 rounded-lg rounded-r-none bg-white border-1 border-purple-200 transition-all -mt-[1px] -ml-[1px]"
                        :class="{
                          'w-[calc(100%_-_132.5px)]': !(aiLoading && generatingPreview),
                          'w-[calc(100%_-_145.5px)]': aiLoading && generatingPreview,
                          '!rounded-r-lg shadow-selected-ai border-nc-border-purple z-11': isOpenSelectRecordDropdown,
                          'shadow-default hover:shadow-hover': !isOpenSelectRecordDropdown,
                        }"
                      >
                        <NcTooltip
                          v-if="selectedRecord?.label"
                          class="truncate flex-1 text-nc-content-purple-dark font-semibold"
                          show-on-truncate-only
                          :disabled="isOpenSelectRecordDropdown"
                        >
                          <template #title>
                            <LazySmartsheetPlainCell v-model="selectedRecord.label" :column="displayField" />
                          </template>
                          <LazySmartsheetPlainCell v-model="selectedRecord.label" :column="displayField" />
                        </NcTooltip>

                        <div v-else class="flex-1 text-nc-content-gray-muted">- Select record -</div>
                        <GeneralIcon
                          icon="chevronDown"
                          class="flex-none opacity-60"
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
                    <NcTooltip
                      :disabled="!!(selectedRecordPk && outputColumnIds.length && vModel.formula_raw)"
                      class="absolute right-0 top-0"
                    >
                      <template #title>
                        {{
                          !vModel.formula_raw
                            ? 'Prompt required for AI Button'
                            : !outputColumnIds.length
                            ? 'At least one output field is required for preview'
                            : !selectedRecordPk
                            ? 'Select sample record first'
                            : ''
                        }}
                      </template>
                      <NcButton
                        size="small"
                        type="secondary"
                        class="nc-ai-button-test-generate"
                        :disabled="aiLoading || !selectedRecordPk || !outputColumnIds.length || !vModel.formula_raw"
                        :loading="aiLoading && generatingPreview"
                        @click.stop="generate"
                      >
                        <template #icon>
                          <GeneralIcon icon="ncAutoAwesome" class="h-4 w-4" />
                        </template>
                        <template #loadingIcon>
                          <GeneralLoader class="!text-current" size="regular" />
                        </template>
                        <div class="flex items-center gap-2">
                          {{ aiLoading && generatingPreview ? 'Test Generating' : 'Test Generate' }}
                        </div>
                      </NcButton>
                    </NcTooltip>
                  </div>
                </a-form-item>

                <div v-if="aiError" class="py-3 pl-3 pr-2 flex items-center gap-3 bg-nc-bg-red-light rounded-lg">
                  <GeneralIcon icon="ncInfoSolid" class="flex-none !text-nc-content-red-dark w-4 h-4" />

                  <div class="text-sm text-nc-content-gray-subtle flex-1 max-w-[calc(100%_-_24px)]">
                    <NcTooltip class="truncate" show-on-truncate-only>
                      <template #title>
                        {{ aiError }}
                      </template>
                      {{ aiError }}
                    </NcTooltip>
                  </div>
                </div>
              </div>

              <a-collapse v-model:active-key="expansionPanel" ghost class="flex-1 flex flex-col">
                <template #expandIcon> </template>
                <a-collapse-panel
                  :key="ExpansionPanelKeys.input"
                  collapsible="disabled"
                  class="nc-ai-button-config-right-section"
                >
                  <template #header>
                    <div class="flex">
                      <div
                        class="text-sm text-nc-content-gray-subtle2 font-bold flex items-center gap-2.5 min-h-7"
                        @click="handleUpdateExpansionPanel(ExpansionPanelKeys.input)"
                      >
                        Input fields

                        <template v-if="inputColumns.length">
                          <a-tag class="!rounded-md !bg-nc-bg-brand !text-nc-content-brand !border-none !mx-0">
                            {{ inputColumns.length }}</a-tag
                          >

                          <NcButton size="xs" type="text" class="hover:!bg-nc-bg-gray-dark !px-1">
                            <GeneralIcon
                              icon="arrowRight"
                              class="transform"
                              :class="{
                                'rotate-270': expansionPanel.includes(ExpansionPanelKeys.input),
                              }"
                            />
                          </NcButton>
                        </template>
                      </div>
                    </div>
                  </template>

                  <div class="flex flex-col gap-4">
                    <LazySmartsheetRow :row="selectedRecord.row">
                      <template v-for="field in inputColumns">
                        <a-form-item
                          v-if="field.title"
                          :key="`${field.id}-${generatingPreview}`"
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
                            class="relative flex items-center min-h-8 children:h-full"
                            :class="{
                              '!select-text nc-system-field': isReadOnlyVirtualCell(field),
                              '!select-text nc-readonly-div-data-cell': !isReadOnlyVirtualCell(field),
                            }"
                          >
                            <LazySmartsheetVirtualCell
                              v-if="isVirtualCol(field)"
                              :model-value="selectedRecord?.row?.row?.[field.title]"
                              class="mt-0 nc-input nc-cell"
                              :class="[`nc-form-input-${field.title?.replaceAll(' ', '')}`, { readonly: field?.read_only }]"
                              :column="field"
                              :read-only="true"
                            />

                            <LazySmartsheetCell
                              v-else
                              :model-value="selectedRecord?.row?.row?.[field.title]"
                              class="nc-input truncate"
                              :class="[`nc-form-input-${field.title?.replaceAll(' ', '')}`, { readonly: field?.read_only }]"
                              :column="field"
                              :edit-enabled="true"
                              :read-only="true"
                            />
                          </LazySmartsheetDivDataCell>
                        </a-form-item>
                      </template>
                    </LazySmartsheetRow>
                  </div>
                </a-collapse-panel>
                <a-collapse-panel
                  :key="ExpansionPanelKeys.output"
                  collapsible="disabled"
                  class="nc-ai-button-config-right-section nc-output-field-collapse-panel flex-1"
                >
                  <template #header>
                    <div class="flex">
                      <div
                        class="text-sm text-nc-content-gray-subtle2 font-bold flex items-center gap-2.5 min-h-7"
                        @click="handleUpdateExpansionPanel(ExpansionPanelKeys.output)"
                      >
                        Output fields

                        <a-tag
                          v-if="outputColumnIds.length"
                          class="!rounded-md !bg-nc-bg-brand !text-nc-content-brand !border-none !mx-0"
                        >
                          {{ outputColumnIds.length }}</a-tag
                        >
                        <NcButton size="xs" type="text" class="hover:!bg-nc-bg-gray-dark !px-1">
                          <GeneralIcon
                            icon="arrowRight"
                            class="transform"
                            :class="{
                              'rotate-270': expansionPanel.includes(ExpansionPanelKeys.output),
                            }"
                          />
                        </NcButton>
                      </div>
                    </div>
                  </template>
                  <div v-if="!outputColumnIds.length" class="flex-1 flex items-center justify-center">
                    <GeneralIcon icon="ncAutoAwesome" class="h-[177px] w-[177px] !text-purple-100" />
                  </div>
                  <div v-else class="flex flex-col gap-4">
                    <LazySmartsheetRow :row="previewOutputRow">
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
                            class="relative min-h-8 flex items-center children:h-full"
                            :class="{
                              '!select-text nc-system-field': isReadOnlyVirtualCell(field),
                              '!select-text nc-readonly-div-data-cell': !isReadOnlyVirtualCell(field),
                            }"
                          >
                            <LazySmartsheetVirtualCell
                              v-if="isVirtualCol(field)"
                              :model-value="previewOutputRow.row[field.title]"
                              class="mt-0 nc-input nc-cell"
                              :class="[`nc-form-input-${field.title?.replaceAll(' ', '')}`, { readonly: field?.read_only }]"
                              :column="field"
                              :read-only="true"
                            />

                            <LazySmartsheetCell
                              v-else
                              v-model="previewOutputRow.row[field.title]"
                              class="nc-input truncate"
                              :class="[`nc-form-input-${field.title?.replaceAll(' ', '')}`, { readonly: field?.read_only }]"
                              :column="field"
                              :edit-enabled="true"
                              :read-only="true"
                            />
                          </LazySmartsheetDivDataCell>
                        </a-form-item>
                      </template>
                    </LazySmartsheetRow>
                  </div>
                </a-collapse-panel>
              </a-collapse>
            </div>
          </div>
        </div>
      </div>
    </NcModal>
  </div>
</template>

<style lang="scss">
.nc-ai-button-config-modal-wrapper {
  @apply !z-1050;

  .ant-modal-content {
    @apply overflow-hidden;
  }
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
  @apply cursor-pointer !rounded-md !bg-nc-bg-gray-medium !text-nc-content-gray hover:!bg-nc-bg-gray-dark !border-none !mx-0;
}

.nc-ai-button-test-generate {
  @apply !rounded-l-none -m-[1px] border-l-0 border-purple-200 !bg-nc-bg-purple-light !text-nc-content-purple-dark hover:(!bg-nc-bg-purple-dark);

  &:disabled {
    @apply !text-nc-content-purple-light !hover:(text-nc-content-purple-light bg-nc-bg-purple-light);
  }
}

:deep(.ant-collapse-header) {
  @apply !p-0 flex items-center !cursor-default children:first:flex;
}
:deep(.ant-collapse-icon-position-right > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow) {
  @apply !right-0;
}

:deep(.ant-collapse-content-box) {
  @apply !px-0 !pb-0 !pt-3;
}

:deep(.ant-collapse-item) {
  &.nc-output-field-collapse-panel {
    .ant-collapse-content {
      @apply flex-1 flex flex-col;
      .ant-collapse-content-box {
        @apply flex-1 flex flex-col gap-4;
      }
    }
  }
}

:deep(.ant-select-selector) {
  @apply !xs:(h-full);
}

.nc-data-cell {
  @apply !rounded-lg;
  transition: all 0.3s;

  &.nc-readonly-div-data-cell,
  &.nc-system-field {
    @apply !border-gray-200;

    .nc-cell,
    .nc-virtual-cell {
      @apply text-nc-content-purple-dark;
    }
  }

  &.nc-readonly-div-data-cell:focus-within,
  &.nc-system-field:focus-within {
    @apply !border-gray-200;
  }

  &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
    @apply !shadow-selected-ai;
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
  @apply !border-1 !border-purple-500;
}
:deep(.nc-system-field input) {
  @apply bg-transparent;
}
:deep(.nc-readonly-div-data-cell input) {
  @apply bg-transparent;
}
:deep(.nc-readonly-div-data-cell textarea) {
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
