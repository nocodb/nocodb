<script setup lang="ts">
interface Props {
  modelValue: boolean
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

const emits = defineEmits<{
  'update:modelValue': [value: boolean]
  'discard': []
  'save-and-continue': []
}>()

const onVisibleChange = (v: boolean) => {
  emits('update:modelValue', v)
}

// Dismiss (X / Escape / overlay) closes the prompt without saving or discarding.
// Both consumers reset their pending close/navigation state on dismiss, so this
// just cancels the action that triggered the prompt and stays on the current row.
const onCancel = () => {
  emits('update:modelValue', false)
}
</script>

<template>
  <NcModal :visible="modelValue" size="xs" height="auto" @update:visible="onVisibleChange">
    <div>
      <div class="flex flex-row items-center justify-between gap-x-2">
        <div class="text-base font-bold">
          {{ $t('labels.saveChanges') }}
        </div>
        <NcButton type="text" size="xsmall" data-testid="nc-discard-changes-modal-close" @click="onCancel">
          <GeneralIcon icon="close" class="text-nc-content-gray-subtle2" />
        </NcButton>
      </div>
      <div class="flex font-medium mt-2">
        {{ $t('activity.doYouWantToSaveTheChanges') }}
      </div>
      <div class="flex flex-row justify-end gap-x-2 mt-5">
        <NcButton type="secondary" size="small" @click="emits('discard')">
          {{ $t('labels.discard') }}
        </NcButton>
        <NcButton type="primary" size="small" :loading="loading" @click="emits('save-and-continue')">
          {{ $t('labels.saveChanges') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
