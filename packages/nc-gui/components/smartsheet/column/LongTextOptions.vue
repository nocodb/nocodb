<script setup lang="ts">
import { UITypes, UITypesName, isAIPromptCol } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: any
}>()

const emit = defineEmits(['update:modelValue', 'navigateToIntegrations'])

const { t } = useI18n()

const meta = inject(MetaInj)!

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const availableFields = computed(() => {
  if (!meta.value?.columns) return []
  return meta.value.columns.filter((c) => c.title && !c.system && c.uidt !== UITypes.ID)
})

const vModel = useVModel(props, 'modelValue', emit)

const { isEdit, setAdditionalValidations, column, formattedData, loadData, disableSubmitBtn } = useColumnCreateStoreOrThrow()

const { aiIntegrationAvailable, generateRows } = useNocoAi()

const { isFeatureEnabled } = useBetaFeatureToggle()

const previewRow = ref<Row>({
  row: {},
  oldRow: {},
  rowMeta: { new: true },
})

const previewFieldTitle = ref(vModel.value.title || 'temp_title')

const generatingPreview = ref(false)

const isAlreadyGenerated = ref(false)

const isPreviewEnabled = computed(() => {
  const isFieldAddedInPromt = availableFields.value.some((f) => {
    return vModel.value.prompt_raw?.includes(`{${f.title}}`)
  })

  return isFieldAddedInPromt
})

const isEnabledGenerateText = computed({
  get: () => {
    return vModel.value.meta?.[LongTextAiMetaProp]
  },
  set: (value: boolean) => {
    vModel.value.meta[LongTextAiMetaProp] = value
    vModel.value.prompt_raw = ''
    previewRow.value.row = {}
    isAlreadyGenerated.value = false
  },
})

const isPvColumn = computed(() => {
  if (!isEdit.value) return false

  return !!column.value?.pv
})

const loadViewData = async () => {
  if (!formattedData.value.length) {
    await loadData(undefined, false)
  }
}

const generate = async () => {
  generatingPreview.value = true

  await loadViewData()

  const pk = formattedData.value.length ? extractPkFromRow(unref(formattedData.value[0].row), meta.value?.columns || []) : ''

  if (!formattedData.value.length || !pk) {
    message.error('Include at least 1 sample record in table to generate')
    generatingPreview.value = false

    return
  }

  previewFieldTitle.value = vModel.value?.title || 'temp_title'

  const res = await generateRows(
    meta.value.id!,
    {
      title: previewFieldTitle.value,
      prompt_raw: vModel.value.prompt_raw,
      fk_integration_id: vModel.value.fk_integration_id,
      uidt: UITypes.LongText,
    },
    [pk],
  )

  if (res?.length && res[0]?.[previewFieldTitle.value]) {
    previewRow.value.row = {
      ...res[0],
      [previewFieldTitle.value]: {
        value: res[0]?.[previewFieldTitle.value],
      },
    }
    isAlreadyGenerated.value = true
  }

  generatingPreview.value = false
}

const isPromptEnabled = computed(() => {
  if (isEdit.value) {
    return isAIPromptCol(column.value) || isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)
  }

  return isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)
})

onMounted(() => {
  // set default value
  vModel.value.prompt_raw = (column?.value?.colOptions as Record<string, any>)?.prompt_raw || ''
})

const validators = {
  fk_integration_id: [
    {
      validator: (_: any, value: any) => {
        return new Promise<void>((resolve, reject) => {
          if (isEnabledGenerateText.value && !value) {
            reject(new Error(t('title.aiIntegrationMissing')))
          }
          resolve()
        })
      },
    },
  ],
}

if (isEdit.value) {
  vModel.value.fk_integration_id = vModel.value?.colOptions?.fk_integration_id
}

setAdditionalValidations({
  ...validators,
})

provide(EditColumnInj, ref(true))

const richMode = computed({
  get: () => !!vModel.value.meta?.richMode,
  set: (value) => {
    if (!vModel.value.meta) vModel.value.meta = {}

    vModel.value.meta.richMode = value
  },
})

const handleDisableSubmitBtn = () => {
  if (!isEnabledGenerateText.value) {
    if (disableSubmitBtn.value) {
      disableSubmitBtn.value = false
    }

    return
  }

  if (isPreviewEnabled.value) {
    disableSubmitBtn.value = false
  } else {
    disableSubmitBtn.value = true
  }
}

watch(richMode, () => {
  vModel.value.cdf = null
})

watch(isPreviewEnabled, handleDisableSubmitBtn, {
  immediate: true,
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <a-form-item>
      <NcTooltip :disabled="!(isEnabledGenerateText || (isPvColumn && !richMode))">
        <template #title>
          {{
            isPvColumn && !richMode
              ? `${UITypesName.RichText} field cannot be used as display value field`
              : 'Rich text formatting is not supported when generate text using AI is enabled'
          }}
        </template>
        <div class="flex items-center gap-1">
          <NcSwitch v-model:checked="richMode" :disabled="isEnabledGenerateText || (isPvColumn && !richMode)">
            <div class="text-sm text-gray-800 select-none font-semibold">
              {{ $t('labels.enableRichText') }}
            </div>
          </NcSwitch>
        </div>
      </NcTooltip>
    </a-form-item>

    <div v-if="isPromptEnabled" class="relative">
      <a-form-item class="flex items-center">
        <NcTooltip :disabled="!(richMode || (isPvColumn && !isEnabledGenerateText))" class="flex items-center">
          <template #title>
            {{
              isPvColumn && !isEnabledGenerateText
                ? `${UITypesName.AIPrompt} field cannot be used as display value field`
                : 'Generate text using AI is not supported when rich text formatting is enabled'
            }}</template
          >

          <NcSwitch
            v-model:checked="isEnabledGenerateText"
            :disabled="richMode || (isPvColumn && !isEnabledGenerateText)"
            class="nc-ai-field-generate-text nc-ai-input"
            @change="handleDisableSubmitBtn"
          >
            <span
              class="text-sm font-semibold pl-1"
              :class="{
                'text-nc-content-purple-dark': isEnabledGenerateText,
                'text-nc-content-gray': !isEnabledGenerateText,
              }"
            >
              Generate text using AI
            </span>
          </NcSwitch>
        </NcTooltip>
        <NcTooltip class="ml-2 mr-[40px] flex cursor-pointer">
          <template #title> Use AI to generate content based on record data. </template>
          <GeneralIcon icon="info" class="text-nc-content-gray-muted hover:text-nc-content-gray-subtle opacity-70 w-3.5 h-3.5" />
        </NcTooltip>
        <div class="flex-1"></div>

        <div class="absolute right-0">
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
      </a-form-item>
    </div>
    <template v-if="isPromptEnabled && (!isEdit ? aiIntegrationAvailable && isEnabledGenerateText : isEnabledGenerateText)">
      <a-form-item class="flex">
        <div class="nc-prompt-input-wrapper bg-nc-bg-gray-light rounded-lg w-full">
          <AiPromptWithFields
            v-model="vModel.prompt_raw"
            :options="availableFields"
            :read-only="!aiIntegrationAvailable"
            placeholder="Write custom AI Prompt instruction here"
            prompt-field-tag-class-name="!text-nc-content-purple-dark font-weight-500"
            suggestion-icon-class-name="!text-nc-content-purple-medium"
          />
          <div class="rounded-b-lg flex items-center gap-1.5 p-1">
            <GeneralIcon icon="info" class="!text-nc-content-purple-medium w-3.5 h-3.5" />
            <span class="text-xs text-nc-content-gray-subtle2"
              >Mention fields using curly braces, e.g. <span class="text-nc-content-purple-dark">{Field name}</span>.</span
            >
          </div>
        </div>
      </a-form-item>
      <div v-if="aiIntegrationAvailable && isEnabledGenerateText" class="nc-ai-options-preview overflow-hidden">
        <div>
          <div
            class="flex items-center gap-2 transition-all duration-300"
            :class="{
              'pl-3 py-2 pr-2': !isAlreadyGenerated,
              'pl-3 py-1 pr-1 border-b-1 border-nc-border-gray-medium': isAlreadyGenerated,
            }"
          >
            <div class="flex flex-col flex-1 gap-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-nc-content-gray-subtle">Preview</span>
                <NcTooltip class="flex cursor-pointer">
                  <template #title> Preview is generated using the first record in this table</template>
                  <GeneralIcon
                    icon="info"
                    class="text-nc-content-gray-muted hover:text-nc-content-gray-subtle opacity-70 w-3.5 h-3.5"
                  />
                </NcTooltip>
              </div>
              <span v-if="!isAlreadyGenerated" class="text-[11px] leading-[18px] text-nc-content-gray-muted">
                Include at least 1 field in prompt.
              </span>
            </div>

            <NcTooltip :disabled="isPreviewEnabled">
              <template #title> Include at least 1 field in prompt to generate </template>
              <NcButton
                class="nc-aioptions-preview-generate-btn"
                :class="{
                  'nc-is-already-generated': isAlreadyGenerated,
                  'nc-preview-enabled': isPreviewEnabled,
                }"
                size="xs"
                :type="isAlreadyGenerated ? 'text' : 'secondary'"
                :theme="isPreviewEnabled ? 'ai' : 'default'"
                :disabled="!isPreviewEnabled"
                :loading="generatingPreview"
                @click.stop="generate"
              >
                <div
                  :class="{
                    'nc-animate-dots min-w-[91px] text-left': generatingPreview,
                    'min-w-[102px]': isAlreadyGenerated && generatingPreview,
                    'min-w-[80px]': !isAlreadyGenerated && generatingPreview,
                  }"
                >
                  {{
                    isAlreadyGenerated
                      ? generatingPreview
                        ? 'Re-generating'
                        : 'Re-generate'
                      : generatingPreview
                      ? 'Generating'
                      : 'Generate preview'
                  }}
                </div>
              </NcButton>
            </NcTooltip>
          </div>
          <div v-if="previewRow.row?.[previewFieldTitle]?.value">
            <div class="relative">
              <LazySmartsheetRow :row="previewRow">
                <LazySmartsheetCell
                  :edit-enabled="true"
                  :model-value="previewRow.row[previewFieldTitle]"
                  :column="vModel"
                  class="!border-none h-auto my-auto pl-1"
                />
              </LazySmartsheetRow>
            </div>
          </div>
        </div>
      </div>
    </template>

    <AiIntegrationNotFound v-if="!aiIntegrationAvailable && isEnabledGenerateText && isPromptEnabled" />
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-form-item-control-input-content) {
  @apply flex items-center;
}

.nc-prompt-input-wrapper {
  @apply border-1 border-nc-border-gray-medium;
  box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
}

.nc-ai-options-preview {
  @apply rounded-lg border-1 border-nc-border-gray-medium;
  box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);

  :deep(.nc-text-area-expand-btn) {
    @apply right-1;
  }
}

.nc-aioptions-preview-generate-btn {
  &:not(.nc-is-already-generated) {
    &.nc-preview-enabled {
      @apply !border-transparent;
    }
  }
}
</style>
