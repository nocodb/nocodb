<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: any
}>()

const emit = defineEmits(['update:modelValue', 'navigateToIntegrations'])

const { t } = useI18n()

const meta = inject(MetaInj)!

const availableFields = computed(() => {
  if (!meta.value?.columns) return []
  return meta.value.columns.filter((c) => c.title && !c.system && c.uidt !== UITypes.ID)
})

const vModel = useVModel(props, 'modelValue', emit)

const { isEdit, setAdditionalValidations, validateInfos, column, formattedData, loadData, disableSubmitBtn } =
  useColumnCreateStoreOrThrow()

const { aiIntegrationAvailable, generateRows } = useNocoAi()

const previewRow = ref<Row>({
  row: {},
  oldRow: {},
  rowMeta: { new: true },
})

const previewFieldTitle = ref(vModel.value.title || '')

const generatingPreview = ref(false)

const isAlreadyGenerated = ref(false)

const isPreviewEnabled = computed(() => {
  const isFieldAddedInPromt = availableFields.value.some((f) => {
    return vModel.value.prompt_raw?.includes(`{${f.title}}`)
  })

  return isFieldAddedInPromt && !!vModel.value.title
})

watch(
  isPreviewEnabled,
  (newValue) => {
    if (newValue) {
      disableSubmitBtn.value = false
    } else {
      disableSubmitBtn.value = true
    }
  },
  {
    immediate: true,
  },
)

const localIsEnabledGenerateText = ref(true)

const isEnabledGenerateText = computed({
  get: () => {
    return aiIntegrationAvailable.value && (!!vModel.value.prompt_raw || localIsEnabledGenerateText.value)
  },
  set: (value: boolean) => {
    localIsEnabledGenerateText.value = value
    vModel.value.prompt_raw = ''
    previewRow.value.row = {}
    isAlreadyGenerated.value = false
  },
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

  previewFieldTitle.value = vModel.value?.title

  const res = await generateRows(
    meta.value.id!,
    {
      title: vModel.value?.title,
      prompt_raw: vModel.value.prompt_raw,
      fk_integration_id: vModel.value.fk_integration_id,
      uidt: UITypes.AI,
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

onMounted(() => {
  // set default value
  vModel.value.prompt_raw = (column?.value?.colOptions as Record<string, any>)?.prompt_raw || ''
  vModel.value.output_column_ids = (column?.value?.colOptions as Record<string, any>)?.output_column_ids || ''

  localIsEnabledGenerateText.value = isEdit.value ? !!vModel.value.prompt_raw : true
})

setAdditionalValidations({ fk_integration_id: [{ required: true, message: t('general.required') }] })

setAdditionalValidations({
  fk_integration_id: [{ required: true, message: t('general.required') }],
  prompt_raw: [
    {
      validator: (_, value: string) => {
        return new Promise((resolve, reject) => {
          const isFieldAddedInPromt = availableFields.value.some((f) => {
            return value?.includes(`{${f.title}}`)
          })
          if (!isFieldAddedInPromt) {
            return reject(new Error('Include at least 1 field in prompt to generate'))
          }
          resolve()
        })
      },
    },
  ],
})

provide(EditColumnInj, ref(true))
</script>

<template>
  <div class="flex flex-col gap-3">
    <a-form-item class="flex items-center" v-bind="validateInfos.richText">
      <NcSwitch v-model:checked="vModel.rich_text" disabled class="nc-ai-field-rich-text nc-ai-input">
        <span class="text-sm font-semibold text-nc-content-gray-muted">Enable rich text</span>
      </NcSwitch>
      <div class="flex-1"></div>
    </a-form-item>
    <a-form-item class="flex items-center">
      <NcSwitch
        v-model:checked="isEnabledGenerateText"
        :disabled="!aiIntegrationAvailable"
        class="nc-ai-field-generate-text nc-ai-input"
      >
        <span
          class="text-sm font-semibold"
          :class="{
            'text-nc-content-purple-dark': isEnabledGenerateText,
            'text-nc-content-gray': !isEnabledGenerateText,
          }"
          >Generate text</span
        >
      </NcSwitch>
      <div class="flex-1"></div>
    </a-form-item>
    <template v-if="isEnabledGenerateText">
      <a-form-item class="flex">
        <div class="nc-prompt-input-wrapper bg-nc-bg-gray-light rounded-lg w-full">
          <AiPromptWithFields
            v-model="vModel.prompt_raw"
            :options="availableFields"
            placeholder="Write a sales campaign addressed to {First Name} informing them about our latest product launch. Use the {Product Name} and {Description} field to elaborate the product and how it would be useful for the customer"
            prompt-field-tag-class-name="!text-nc-content-purple-dark font-weight-500"
            suggestion-icon-class-name="!text-nc-content-purple-medium"
          />
          <div class="rounded-b-lg flex items-center gap-2 p-1">
            <GeneralIcon icon="info" class="!text-nc-content-purple-medium h-4 w-4" />
            <span class="text-xs text-nc-content-gray-subtle2"
              >Mention fields using curly braces, e.g. <span class="text-nc-content-purple-dark">{Field name}</span>.</span
            >
          </div>
        </div>
      </a-form-item>
      <div class="nc-ai-options-preview">
        <div class="">
          <div
            class="flex items-center transition-all duration-300"
            :class="{
              'pl-3 py-2 pr-2': !isAlreadyGenerated,
              'pl-3 py-1 pr-1 border-b-1 border-nc-border-gray-medium': isAlreadyGenerated,
            }"
          >
            <div class="flex flex-col flex-1 gap-1">
              <span class="text-small font-medium text-nc-content-gray">Preview</span>
              <span v-if="!isAlreadyGenerated" class="text-[11px] leading-[18px] text-nc-content-gray-muted">
                Include at least 1 field in prompt to generate
              </span>
            </div>
            <NcTooltip :disabled="isPreviewEnabled">
              <template #title>
                {{ !vModel.title ? 'Field name is required' : 'Include at least 1 field in prompt to generate' }}
              </template>
              <NcButton
                class="nc-aioptions-preview-generate-btn"
                :class="{
                  'nc-is-already-generated': isAlreadyGenerated,
                }"
                size="xs"
                :type="isAlreadyGenerated ? 'text' : 'secondary'"
                theme="ai"
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
                      : 'Generate'
                  }}
                </div>
              </NcButton>
            </NcTooltip>
          </div>
          <div v-if="previewRow.row?.[previewFieldTitle]?.value">
            <div class="relative pr-3 pl-1 pt-2 pb-3">
              <LazySmartsheetRow :row="previewRow">
                <LazySmartsheetCell
                  :edit-enabled="true"
                  :model-value="previewRow.row[previewFieldTitle]"
                  :column="vModel"
                  class="!border-none h-auto my-auto"
                />
              </LazySmartsheetRow>
            </div>
          </div>
        </div>
      </div>
    </template>

    <AiIntegrationNotFound v-if="!aiIntegrationAvailable" />
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
}

.nc-aioptions-preview-generate-btn {
  &:not(.nc-is-already-generated) {
    @apply !border-transparent;
  }
}
</style>
