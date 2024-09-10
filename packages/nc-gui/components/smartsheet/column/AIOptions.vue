<script setup lang="ts">
import type { ColumnType, UITypes } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: any
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { fields, metaColumnById } = useViewColumnsOrThrow()

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const vModel = useVModel(props, 'modelValue', emit)

const { setAdditionalValidations, validateInfos, column, isEdit } = useColumnCreateStoreOrThrow()

onMounted(() => {
  // set default value
  vModel.value.prompt_raw = (column?.value?.colOptions as Record<string, any>)?.prompt_raw || ''
})

setAdditionalValidations({ fk_integration_id: [{ required: true, message: t('general.required') }] })
</script>

<template>
  <div class="flex flex-col gap-3">
    <a-form-item class="flex items-center" v-bind="validateInfos.richText">
      <NcSwitch v-model:checked="vModel.rich_text" class="nc-ai-field-rich-text">
        <span class="text-sm font-bold text-gray-600">Enable rich text</span>
      </NcSwitch>
      <div class="flex-1"></div>
      <AiSettings v-model:settings="vModel" :workspace-id="activeWorkspaceId" />
    </a-form-item>
    <a-form-item class="flex">
      <a-textarea v-model:value="vModel.prompt_raw" class="nc-ai-field-prompt-input !rounded-lg !outline-0 !ring-0" :rows="5" />
      <div class="absolute w-full bottom-[-1px] bg-purple-50 rounded-b-lg flex items-center gap-2 p-1">
        <GeneralIcon icon="info" />
        <span class="text-xs text-gray-500">Mention fields using curly braces, e.g. {Field name}.</span>
      </div>
    </a-form-item>
    <div class="shadow-default flex p-2 text-xs items-center">
      <div class="flex flex-col flex-1 gap-1">
        <span class="font-bold text-gray-600">Preview</span>
        <span class="text-gray-400 text-[11px]">Include at least 1 field in prompt to generate</span>
      </div>
      <NcButton class="!bg-purple-50" size="small"> <span class="text-purple-600">Generate</span></NcButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-ai-field-prompt-input {
  @apply shadow-default;
}

:deep(.ant-form-item-control-input-content) {
  @apply flex items-center;
}
</style>
