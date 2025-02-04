<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'

const props = defineProps<{
  modelValue: boolean
  rows: number
}>()

const emit = defineEmits(['cancel', 'update:modelValue', 'deleteAll'])

const dialogShow = useVModel(props, 'modelValue', emit)

onKeyDown('esc', () => {
  dialogShow.value = false
  emit('update:modelValue', false)
})

const close = () => {
  dialogShow.value = false
  emit('cancel')
}
</script>

<template>
  <NcModal
    v-if="dialogShow"
    v-model:visible="dialogShow"
    :show-separator="false"
    :header="$t('activity.deleteAllRecords')"
    size="small"
    @keydown.esc="dialogShow = false"
  >
    <div class="flex justify-between w-full text-base font-semibold mb-2 text-nc-content-gray-emphasis items-center">
      {{ 'Delete all records' }}
    </div>
    <div data-testid="nc-expand-table-modal" class="flex flex-col">
      <div class="mb-2 nc-content-gray">Are you sure you want to delete all {{ rows }} records present in this view?</div>
    </div>

    <div class="bg-nc-bg-gray-light py-2 px-4 flex items-center gap-4 w-full rounded-lg">
      <div class="leading-5 text-nc-content-gray">This action cannot be undone.</div>
    </div>

    <div class="flex flex-row mt-5 justify-end gap-x-2">
      <div class="flex gap-2 items-center">
        <NcButton data-testid="nn-record-delete-cancel" type="secondary" size="small" @click="close">
          {{ $t('labels.cancel') }}
        </NcButton>
      </div>
      <div class="flex gap-2 items-center">
        <NcButton data-testid="nc-record-delete-all" type="danger" size="small" @click="emit('deleteAll')">
          {{ $t('general.delete') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
