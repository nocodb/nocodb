<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'

const props = defineProps<{
  modelValue: boolean
  rows: number
  isSelectedAll?: boolean
}>()

const emit = defineEmits(['cancel', 'update:modelValue', 'deleteAll'])

const dialogShow = useVModel(props, 'modelValue', emit)

// The delete is a server-side sweep — on a large table it runs for many
// seconds, and every extra click fires another one.
const isDeleting = ref(false)

onKeyDown('esc', () => {
  if (isDeleting.value) return

  dialogShow.value = false
  emit('update:modelValue', false)
})

const close = () => {
  if (isDeleting.value) return

  dialogShow.value = false
  emit('cancel')
}

const onDeleteAll = () => {
  if (isDeleting.value) return

  isDeleting.value = true
  emit('deleteAll')
}
</script>

<template>
  <NcModal
    v-if="dialogShow"
    v-model:visible="dialogShow"
    :show-separator="false"
    :header="$t('activity.deleteAllRecords')"
    size="small"
    :mask-closable="!isDeleting"
    :keyboard="!isDeleting"
    @keydown.esc="isDeleting || (dialogShow = false)"
  >
    <div class="flex justify-between w-full text-base font-semibold mb-2 text-nc-content-gray-emphasis items-center">
      {{ isSelectedAll ? $t('activity.deleteAllRecords') : $t('activity.deleteAllSelectedRecords') }}
    </div>
    <div data-testid="nc-expand-table-modal" class="flex flex-col">
      <div class="mb-2 nc-content-gray">{{ $t('objects.deleteAllRecordDlg.subtitle', { rowCount: rows }) }}</div>
    </div>

    <div class="bg-nc-bg-gray-light py-2 px-4 flex items-center gap-4 w-full rounded-lg">
      <div class="leading-5 text-nc-content-gray">{{ $t('objects.deleteAllRecordDlg.warning') }}</div>
    </div>

    <div class="flex flex-row mt-5 justify-end gap-x-2">
      <div class="flex gap-2 items-center">
        <NcButton data-testid="nn-record-delete-cancel" type="secondary" size="small" :disabled="isDeleting" @click="close">
          {{ $t('labels.cancel') }}
        </NcButton>
      </div>
      <div class="flex gap-2 items-center">
        <NcButton
          data-testid="nc-record-delete-all"
          type="danger"
          size="small"
          :loading="isDeleting"
          :disabled="isDeleting"
          @click="onDeleteAll"
        >
          {{ $t('general.delete') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
