<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: any
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const meta = inject(MetaInj)!

const availableFields = computed(() => {
  if (!meta.value?.columns) return []
  return meta.value.columns.filter((c) => c.title && !c.system && c.uidt !== UITypes.ID)
})

const workspaceStore = useWorkspace()

const vModel = useVModel(props, 'modelValue', emit)

const { setAdditionalValidations, validateInfos, column } = useColumnCreateStoreOrThrow()

const localIsEnabledGenerateText = ref(false)

const isEnabledGenerateText = computed({
  get: () => {
    return !!vModel.value.prompt_raw || localIsEnabledGenerateText.value
  },
  set: (value: boolean) => {
    localIsEnabledGenerateText.value = value
    vModel.value.prompt_raw = ''
  },
})

const preview = ref('')

onMounted(() => {
  // set default value
  vModel.value.prompt_raw = (column?.value?.colOptions as Record<string, any>)?.prompt_raw || ''
  vModel.value.output_column_ids = (column?.value?.colOptions as Record<string, any>)?.output_column_ids || ''

  localIsEnabledGenerateText.value = !!vModel.value.prompt_raw
})

setAdditionalValidations({ fk_integration_id: [{ required: true, message: t('general.required') }] })
</script>

<template>
  <div class="flex flex-col gap-3">
    <a-form-item class="flex items-center" v-bind="validateInfos.richText">
      <NcSwitch v-model:checked="vModel.rich_text" class="nc-ai-field-rich-text nc-ai-input">
        <span class="text-sm font-semibold text-nc-content-gray">Enable rich text</span>
      </NcSwitch>
      <div class="flex-1"></div>
    </a-form-item>
    <a-form-item class="flex items-center">
      <NcSwitch v-model:checked="isEnabledGenerateText" class="nc-ai-field-generate-text nc-ai-input">
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
      <a-form-item class="nc-prompt-input-wrapper flex bg-nc-bg-gray-light rounded-lg">
        <div class="w-full">
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
        <div v-if="preview" class="">
          <!-- Todo: add input box  -->
        </div>
        <div v-else class="pl-3 py-2 pr-2 flex items-center">
          <div class="flex flex-col flex-1 gap-1">
            <span class="text-small font-medium text-nc-content-gray">Preview</span>
            <span class="text-[11px] leading-[18px] text-nc-content-gray-muted"
              >Include at least 1 field in prompt to generate</span
            >
          </div>
          <NcButton class="!bg-purple-50" size="xs"> <div class="text-purple-600">Generate</div></NcButton>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-ai-field-prompt-input {
  @apply shadow-default;
}

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
