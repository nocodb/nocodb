<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  tableId: string
  fileCount: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'select': [field: ColumnType]
  'cancel': []
}>()

const dialogShow = useVModel(props, 'modelValue', emit, { defaultValue: false })

const { t } = useI18n()

const columnSelectorRef = ref()
const selectedFieldId = ref<string | undefined>()

const filterAttachmentColumns = (col: ColumnType) => col.uidt === UITypes.Attachment && !col.system

const handleConfirm = () => {
  const col = columnSelectorRef.value?.selectedColumn
  if (col) {
    emit('select', col as ColumnType)
    dialogShow.value = false
  }
}

const handleCancel = () => {
  emit('cancel')
  dialogShow.value = false
}
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    size="small"
    wrap-class-name="nc-attachment-field-select-modal-wrapper"
    @keydown.esc="handleCancel"
  >
    <template #header>
      <div class="flex flex-col gap-1 w-full">
        <div class="text-base font-bold text-nc-content-gray-emphasis">
          {{ t('title.selectAttachmentField') }}
        </div>
        <div class="text-sm font-normal text-nc-content-gray-subtle">
          {{ t('msg.selectAttachmentFieldDescription') }}
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-4 mt-2">
      <NcListColumnSelector
        ref="columnSelectorRef"
        v-model:value="selectedFieldId"
        :table-id="tableId"
        :filter-column="filterAttachmentColumns"
        :disable-label="true"
        auto-select
      />

      <div class="flex justify-end gap-2">
        <NcButton type="secondary" size="small" @click="handleCancel">
          {{ t('general.cancel') }}
        </NcButton>
        <NcButton type="primary" size="small" :disabled="!selectedFieldId" @click="handleConfirm">
          {{ t('activity.createNRecords', { count: fileCount }) }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
