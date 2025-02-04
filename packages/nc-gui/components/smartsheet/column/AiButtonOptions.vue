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
  fromTableExplorer,
} = useColumnCreateStoreOrThrow()

const { aiIntegrationAvailable, aiLoading, aiError, generateRows } = useNocoAi()

const { isFeatureEnabled } = useBetaFeatureToggle()

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

const defaultRow = {
  row: {},
  oldRow: {},
  rowMeta: {},
}

const previewOutputRow = ref<Row>(defaultRow)

const generatingPreview = ref(false)

const isAlreadyGenerated = ref(false)

const isLoadingViewData = ref(false)

const inputFieldPlaceholder = 'Enter prompt here...\n\n eg : Categorise this {Notes}'

const displayField = computed(() => meta.value?.columns?.find((c) => c?.pv) || meta.value?.columns?.[0] || null)

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

const loadViewData = async (selectDefaultRecord = false) => {
  if (!formattedData.value.length && !isLoadingViewData.value) {
    isLoadingViewData.value = true

    await loadData(undefined, false)

    await ncDelay(250)

    isLoadingViewData.value = false
  }

  if (selectDefaultRecord && sampleRecords.value.length) {
    selectedRecordPk.value = sampleRecords.value[0].value
  }
}

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

const expansionInputPanel = ref<ExpansionPanelKeys[]>([])

const handleUpdateExpansionInputPanel = () => {
  if (expansionInputPanel.value.includes(ExpansionPanelKeys.input)) {
    expansionInputPanel.value = []
  } else {
    expansionInputPanel.value = [ExpansionPanelKeys.input]
  }
}

const expansionOutputPanel = ref<ExpansionPanelKeys[]>([ExpansionPanelKeys.output])

// provide the following to override the default behavior and enable input fields like in form
provide(ActiveCellInj, ref(true))
provide(IsFormInj, ref(true))

watch(isOpenConfigModal, (newValue) => {
  if (newValue) {
    isAiButtonConfigModalOpen.value = true
    loadViewData(true)
  } else {
    setTimeout(() => {
      isAiButtonConfigModalOpen.value = false
    }, 500)

    isOpenSelectOutputFieldDropdown.value = false
    isOpenSelectRecordDropdown.value = false
  }
})

watch(isOpenSelectRecordDropdown, (newValue) => {
  if (newValue) {
    loadViewData()
  }
})

const isAiButtonEnabled = computed(() => {
  if (isEdit.value) {
    return true
  }

  return isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)
})

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

const handleResetOutput = () => {
  isAlreadyGenerated.value = false

  previewOutputRow.value = { row: {}, oldRow: {}, rowMeta: {} }
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
  <div v-if="isAiButtonEnabled" class="relative flex flex-col gap-4">
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
            v-if="!fromTableExplorer"
            size="small"
            type="primary"
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
            <div class="h-full w-1/2 border-r-1 border-r-nc-border-gray-medium">
              <div class="border-b-1 border-b-nc-border-gray-medium py-2.5 w-full">
                <div class="flex items-center mx-auto px-6 w-full max-w-[568px]">
                  <div class="text-base text-nc-content-gray font-bold flex-1">
                    {{ $t('general.configure') }}
                  </div>
                  <div class="-my-1.5">
                    <AiSettings
                      v-model:fk-integration-id="vModel.fk_integration_id"
                      v-model:model="vModel.model"
                      v-model:randomness="vModel.randomness"
                      :workspace-id="activeWorkspaceId"
                      :show-tooltip="false"
                      :is-edit-column="isEdit"
                      placement="bottomRight"
                    >
                      <NcButton size="xs" theme="ai" class="!px-1" type="text">
                        <GeneralIcon icon="settings" />
                      </NcButton>
                    </AiSettings>
                  </div>
                </div>
              </div>
              <a-form
                v-model="vModel"
                no-style
                layout="vertical"
                class="nc-ai-button-config-left-section flex flex-col h-[calc(100%_-_45px)] nc-scrollbar-thin"
                @submit.prevent
              >
                <a-form-item class="!my-0" v-bind="validateInfos.formula_raw">
                  <div class="flex flex-col gap-2">
                    <div class="font-bold">Input Prompt</div>
                    <div class="text-small leading-[18px] text-nc-content-gray-subtle2">
                      Include at least one field in your prompt. Optionally, specify how the field's data should guide the AI's
                      response and the format for the output.
                    </div>
                  </div>
                  <div class="nc-prompt-input-wrapper bg-nc-bg-gray-light rounded-lg w-full mt-2">
                    <AiPromptWithFields
                      v-model="vModel.formula_raw"
                      :options="availableFields"
                      :placeholder="inputFieldPlaceholder"
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

                <a-form-item v-bind="validateInfos.output_column_ids" class="!mb-0 !mt-7">
                  <div class="flex flex-col gap-2">
                    <div class="font-bold">Choose Output Fields To Be Generated by AI</div>
                    <div class="text-small leading-[18px] text-nc-content-gray-subtle2">
                      Choose the fields where the AI-generated data will be applied.
                    </div>
                    <NcDropdown
                      v-model:visible="isOpenSelectOutputFieldDropdown"
                      placement="bottomRight"
                      overlay-class-name="overflow-hidden"
                    >
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
                          class="!w-auto"
                          is-multi-select
                          show-search-always
                          container-class-name="!max-h-[171px]"
                        >
                          <template #listItem="{ option, isSelected }">
                            <NcCheckbox :checked="isSelected" />

                            <div class="inline-flex items-center gap-2 flex-1 truncate">
                              <component :is="cellIcon(option)" class="!mx-0" />
                              <NcTooltip class="truncate flex-1" show-on-truncate-only>
                                <template #title>
                                  {{ option?.title }}
                                </template>
                                {{ option?.title }}
                              </NcTooltip>
                            </div>
                          </template>
                          <template #headerExtraRight>
                            <NcBadge :border="false" color="brand"
                              >{{ outputColumnIds.length }}
                              {{ $t(`objects.${outputColumnIds?.length === 1 ? 'field' : 'fields'}`) }}
                            </NcBadge>
                          </template>
                        </NcList>
                      </template>
                    </NcDropdown>
                  </div>
                  <div v-if="outputFieldOptions.length" class="flex flex-wrap gap-3 mt-3">
                    <template v-for="op in outputFieldOptions">
                      <a-tag v-if="outputColumnIds.includes(op.id)" :key="op.id" class="nc-ai-button-output-field">
                        <div class="flex flex-row items-center gap-1 py-[2px] text-sm">
                          <component :is="cellIcon(op)" class="!mx-0 !mr-1 opacity-80" />
                          <NcTooltip show-on-truncate-only class="truncate max-w-[150px]">
                            <template #title>{{ op.title }}</template>
                            {{ op.title }}
                          </NcTooltip>

                          <div class="flex items-center p-0.5 mt-0.5">
                            <GeneralIcon
                              icon="close"
                              class="h-4 w-4 cursor-pointer opacity-60"
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
              class="h-full w-1/2 bg-[#FCF8FF] flex flex-col relative"
              @scroll.passive="checkScrollTopMoreThanZero"
            >
              <div class="border-b-1 border-b-nc-border-gray-medium py-2.5 w-full">
                <div class="flex items-center mx-auto px-6 w-full max-w-[568px]">
                  <div class="text-base text-nc-content-gray font-bold flex-1">Test Data Generation</div>
                </div>
              </div>
              <div class="flex flex-col gap-6 h-[calc(100%_-_45px)] nc-scrollbar-thin py-6">
                <div v-if="aiError" class="nc-ai-button-config-right-section">
                  <div class="py-3 pl-3 pr-2 flex items-center gap-3 bg-nc-bg-red-light rounded-lg w-full">
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

                <div class="nc-ai-button-config-right-section">
                  <div class="px-3 py-1 text-nc-content-gray-subtle2 text-sm">Input fields</div>
                  <div class="flex-1 flex border-1 bg-white border-nc-border-gray-medium rounded-xl mt-2 w-full">
                    <a-collapse
                      v-model:active-key="expansionInputPanel"
                      ghost
                      class="flex-1 nc-ai-button-config-right-collapse nc-collapse-input w-full"
                    >
                      <template #expandIcon> </template>
                      <a-collapse-panel :key="ExpansionPanelKeys.input" collapsible="disabled">
                        <template #header>
                          <div
                            class="flex w-full p-2"
                            :class="{
                              'border-b-1 border-nc-border-gray-medium': expansionInputPanel.includes(ExpansionPanelKeys.input),
                            }"
                          >
                            <div class="w-full text-sm text-nc-content-gray-subtle2 font-bold flex items-center gap-2.5 min-h-7">
                              <NcButton
                                icon-only
                                type="text"
                                size="xs"
                                class="!px-1"
                                @click.stop="handleUpdateExpansionInputPanel()"
                              >
                                <template #icon>
                                  <GeneralIcon
                                    :icon="expansionInputPanel.includes(ExpansionPanelKeys.input) ? 'eye' : 'eyeSlash'"
                                  />
                                </template>
                              </NcButton>
                              <NcDropdown
                                v-model:visible="isOpenSelectRecordDropdown"
                                placement="bottom"
                                overlay-class-name="overflow-hidden"
                              >
                                <NcButton
                                  size="xs"
                                  type="text"
                                  class="flex-1 children:children:w-full !font-bold !text-sm"
                                  :class="{
                                    '!text-gray-900 !bg-gray-100': isOpenSelectRecordDropdown,
                                  }"
                                  @click.stop
                                >
                                  <NcTooltip
                                    v-if="selectedRecordPk && displayField"
                                    class="w-full text-left truncate !leading-6"
                                    show-on-truncate-only
                                  >
                                    <template #title>
                                      <LazySmartsheetPlainCell
                                        v-model="selectedRecord.row.row[displayField.title]"
                                        :column="displayField"
                                        class="!leading-6"
                                      />
                                    </template>

                                    <LazySmartsheetPlainCell
                                      v-model="selectedRecord.row.row[displayField.title]"
                                      :column="displayField"
                                      class="!leading-6"
                                    />
                                  </NcTooltip>
                                  <div v-else class="flex-1 flex items-center gap-2">- Select Record -</div>
                                  <GeneralLoader v-if="isLoadingViewData && !isOpenSelectRecordDropdown" size="regular" />
                                  <GeneralIcon
                                    v-else
                                    icon="chevronDown"
                                    class="!text-current opacity-70 flex-none transform transition-transform duration-250 w-4 h-4 ml-1"
                                    :class="{ '!rotate-180': isOpenSelectRecordDropdown }"
                                  />
                                </NcButton>

                                <template #overlay>
                                  <div
                                    v-if="isLoadingViewData"
                                    class="min-w-[500px] max-w-[576px] min-h-[296px] relative flex flex-col items-center justify-center gap-2 min-h-25 text-nc-content-brand"
                                  >
                                    <GeneralLoader size="large" class="flex-none" />
                                    Loading records
                                  </div>
                                  <NcList
                                    v-else
                                    v-model:value="selectedRecordPk"
                                    v-model:open="isOpenSelectRecordDropdown"
                                    :list="sampleRecords"
                                    show-search-always
                                    search-input-placeholder="Search records"
                                    :item-height="60"
                                    class="!w-auto min-w-[550px] max-w-[550px]"
                                    container-class-name="!px-0 !pb-0"
                                    item-class-name="!rounded-none !p-0 !bg-none !hover:bg-none"
                                    @update:value="handleResetOutput"
                                  >
                                    <template #listItem="{ option, isSelected }">
                                      <NcListRecordItem
                                        :row="option.row || {}"
                                        :columns="meta?.columns || []"
                                        :is-selected="isSelected"
                                        class="!cursor-pointer"
                                        display-value-class-name="!text-nc-content-gray"
                                      />
                                    </template>
                                  </NcList>
                                </template>
                              </NcDropdown>
                            </div>
                          </div>
                        </template>

                        <div v-if="!inputColumns.length" class="flex-1 flex text-nc-content-gray-muted text-small leading-[18px]">
                          No input fields selected
                        </div>
                        <div v-else class="flex flex-col gap-4 w-full">
                          <LazySmartsheetRow :key="selectedRecordPk" :row="selectedRecord.row">
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
                                  class="relative flex items-center min-h-8 children:h-full bg-nc-bg-gray-extralight max-w-full"
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
                    </a-collapse>
                  </div>
                </div>
                <div
                  class="flex justify-center nc-ai-button-test-generate-wrapper"
                  :class="{
                    'text-nc-border-gray-dark': !(selectedRecordPk && outputColumnIds.length && inputColumns.length),
                    'text-nc-content-purple-dark': !!(selectedRecordPk && outputColumnIds.length && inputColumns.length),
                  }"
                >
                  <div class="h-2.5 w-2.5 flex-none absolute -top-[30px] border-1 border-current rounded-full bg-current"></div>
                  <NcTooltip :disabled="!!(selectedRecordPk && outputColumnIds.length && inputColumns.length)">
                    <template #title>
                      <div class="flex flex-col gap-2 py-1 px-0.5">
                        <div class="text-[10px] leading-[14px] text-gray-300 uppercase mb-1">Preview checklist</div>

                        <div class="flex gap-2">
                          <div
                            class="h-4 w-4 rounded-full grid place-items-center children:(h-3.5 w-3.5 flex-none)"
                            :class="
                              inputColumns.length
                                ? 'bg-nc-bg-green-dark text-nc-content-green-dark'
                                : 'bg-nc-bg-red-dark text-nc-content-red-dark'
                            "
                          >
                            <GeneralIcon :icon="inputColumns.length ? 'check' : 'ncX'" />
                          </div>
                          <div>Use at least 1 Field in your Input prompt</div>
                        </div>
                        <div class="flex gap-2">
                          <div
                            class="h-4 w-4 rounded-full grid place-items-center children:(h-3.5 w-3.5 flex-none)"
                            :class="
                              outputColumnIds.length
                                ? 'bg-nc-bg-green-dark text-nc-content-green-dark'
                                : 'bg-nc-bg-red-dark text-nc-content-red-dark'
                            "
                          >
                            <GeneralIcon :icon="outputColumnIds.length ? 'check' : 'ncX'" />
                          </div>
                          <div>Choose at least 1 Output Field</div>
                        </div>
                        <div class="flex gap-2">
                          <div
                            class="h-4 w-4 rounded-full grid place-items-center children:(h-3.5 w-3.5 flex-none)"
                            :class="
                              selectedRecordPk
                                ? 'bg-nc-bg-green-dark text-nc-content-green-dark'
                                : 'bg-nc-bg-red-dark text-nc-content-red-dark'
                            "
                          >
                            <GeneralIcon :icon="selectedRecordPk ? 'check' : 'ncX'" />
                          </div>
                          <div>Select sample record</div>
                        </div>
                      </div>
                    </template>
                    <NcButton
                      size="small"
                      theme="ai"
                      type="primary"
                      class="nc-ai-button-test-generate"
                      :disabled="aiLoading || !selectedRecordPk || !outputColumnIds.length || !inputColumns.length"
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
                        {{
                          aiLoading && generatingPreview
                            ? isAlreadyGenerated
                              ? 'Re-generating data'
                              : 'Generating data'
                            : isAlreadyGenerated
                            ? 'Re-generate data'
                            : 'Generate data'
                        }}
                      </div>
                    </NcButton>
                  </NcTooltip>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="8"
                    viewBox="0 0 10 8"
                    fill="none"
                    class="absolute -bottom-[24px] z-10"
                  >
                    <path
                      d="M5.86603 7.5C5.48113 8.16667 4.51887 8.16667 4.13397 7.5L0.669873 1.5C0.284973 0.833334 0.766099 0 1.5359 0H8.4641C9.2339 0 9.71503 0.833333 9.33013 1.5L5.86603 7.5Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div class="nc-ai-button-config-right-section">
                  <div
                    class="flex-1 flex border-1 bg-white border-nc-border-gray-medium rounded-xl w-full"
                    :class="{
                      'nc-is-already-generated': isAlreadyGenerated,
                    }"
                  >
                    <a-collapse
                      v-model:active-key="expansionOutputPanel"
                      ghost
                      class="flex-1 nc-ai-button-config-right-collapse nc-collapse-output w-full"
                    >
                      <template #expandIcon> </template>
                      <a-collapse-panel :key="ExpansionPanelKeys.output" collapsible="disabled">
                        <template #header> </template>
                        <div
                          v-if="!outputColumnIds.length"
                          class="flex-1 flex text-nc-content-gray-muted text-small leading-[18px]"
                        >
                          No output fields selected
                        </div>
                        <div v-else class="flex flex-col gap-4 w-full">
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
                                  class="relative min-h-8 flex items-center children:h-full max-w-full"
                                  :class="{
                                    '!select-text nc-system-field': isReadOnlyVirtualCell(field),
                                    '!select-text nc-readonly-div-data-cell': !isReadOnlyVirtualCell(field),
                                    'bg-nc-bg-gray-extralight': !isAlreadyGenerated,
                                    'bg-nc-bg-purple-light': isAlreadyGenerated,
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
          </div>
        </div>
      </div>
    </NcModal>
  </div>
  <div v-else></div>
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
  width: min(100%, 568px);
}
.nc-ai-button-config-right-section {
  @apply mx-auto px-6 w-full max-w-[576px] flex flex-col;

  width: min(100%, 576px);

  .nc-is-already-generated {
    box-shadow: 0px 12px 16px -4px rgba(75, 23, 123, 0.12), 0px 4px 6px -2px rgba(75, 23, 123, 0.08);
  }
}

.nc-ai-button-output-field {
  @apply cursor-pointer !rounded-md !bg-nc-bg-gray-medium !text-nc-content-gray hover:!bg-nc-bg-gray-dark !border-none !mx-0;
}

.nc-ai-button-test-generate-wrapper {
  @apply relative;

  &:before {
    @apply content-[''] h-[24px] block border-r-1 absolute -top-[24px] border-current;
  }
  &:after {
    @apply content-[''] h-[24px] block border-r-1 absolute -bottom-[24px] border-current;
  }
}

:deep(.ant-collapse-header) {
  @apply !p-0 flex items-center !cursor-default children:first:flex;
}
:deep(.ant-collapse-icon-position-right > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow) {
  @apply !right-0;
}

:deep(.ant-collapse-content-box) {
  @apply !p-4;
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
