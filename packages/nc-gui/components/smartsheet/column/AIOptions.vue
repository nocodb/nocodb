<script setup lang="ts">
import { UITypes, type AIRecordType } from 'nocodb-sdk'

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

const { setAdditionalValidations, validateInfos, column } = useColumnCreateStoreOrThrow()

const { aiIntegrationAvailable, generateRows } = useNocoAi()

const localIsEnabledGenerateText = ref(false)

const isEnabledGenerateText = computed({
  get: () => {
    return aiIntegrationAvailable.value && (!!vModel.value.prompt_raw || localIsEnabledGenerateText.value)
  },
  set: (value: boolean) => {
    localIsEnabledGenerateText.value = value
    vModel.value.prompt_raw = ''
  },
})

const preview = ref<AIRecordType>({})

const generatingPreview = ref(false)

const isAlreadyGenerated = ref(false)

const isPreviewEnabled = computed(() => {
  const isFieldAddedInPromt = availableFields.value.some((f) => {
    return vModel.value.prompt_raw?.includes(`{${f.title}}`)
  })

  return isFieldAddedInPromt && !!vModel.value.title
})

const generate = async () => {
  generatingPreview.value = true

  const res = await generateRows(
    meta.value?.id!,
    {
      title: vModel.value?.title,
      prompt_raw: vModel.value.prompt_raw,
      fk_integration_id: vModel.value.fk_integration_id,
      uidt: UITypes.AI,
    },
    ['1'],
  )

  if (res?.length && res[0]?.[vModel.value?.title]) {
    preview.value.value = res[0]?.[vModel.value?.title]

    isAlreadyGenerated.value = true
  }

  generatingPreview.value = false
}

onMounted(() => {
  // set default value
  vModel.value.prompt_raw = (column?.value?.colOptions as Record<string, any>)?.prompt_raw || ''
  vModel.value.output_column_ids = (column?.value?.colOptions as Record<string, any>)?.output_column_ids || ''

  localIsEnabledGenerateText.value = !!vModel.value.prompt_raw
})

setAdditionalValidations({ fk_integration_id: [{ required: true, message: t('general.required') }] })

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
          <AiPromptWithFields v-model="vModel.prompt_raw" :options="availableFields" />
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
              <span v-if="!isAlreadyGenerated" class="text-[11px] leading-[18px] text-nc-content-gray-muted"
                >Include at least 1 field in prompt to generate</span
              >
            </div>
            <NcTooltip :disabled="isPreviewEnabled">
              <template #title>
                {{ !vModel.title ? 'Field name is required' : 'Include at least 1 field in prompt to generate' }}
              </template>
              <NcButton
                class="!text-nc-content-purple-dark disabled:!text-nc-content-purple-light"
                :class="{
                  '!bg-transparent hover:!bg-nc-bg-purple-light disabled:!bg-transparent': isAlreadyGenerated,
                  '!bg-nc-bg-purple-light hover:!bg-nc-bg-purple-dark': !isAlreadyGenerated,
                }"
                size="xs"
                type="text"
                :disabled="!isPreviewEnabled"
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
          <div v-if="preview.value">
            <div class="relative pr-3 pl-1 pt-2 pb-3">
              <LazySmartsheetCell
                :edit-enabled="true"
                :model-value="preview"
                :column="vModel"
                class="!border-none h-auto my-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="!aiIntegrationAvailable" class="py-2 pl-3 pr-2 flex items-center gap-2 bg-nc-bg-orange-light rounded-lg">
      <GeneralIcon icon="alertTriangleSolid" class="!text-nc-content-orange-medium w-4 h-4" />
      <div class="text-sm text-nc-content-gray-subtle flex-1">No AI Integrations added.</div>

      <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="emit('navigateToIntegrations')">
        Add integration
      </NcButton>
    </div>
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
</style>
