<script setup lang="ts">
const props = defineProps<{
  visible?: boolean
  saving?: boolean
}>()

const emit = defineEmits(['submit', 'cancel', 'update:visible'])

const visible = useVModel(props, 'visible', emit)
</script>

<template>
  <GeneralModal v-model:visible="visible" size="small">
    <div class="flex flex-col p-6" @click.stop>
      <div class="flex flex-row pb-2 mb-4 font-medium text-lg border-b-1 border-gray-50 text-gray-800">Field Type Change</div>

      <div class="mb-3 text-gray-800">
        <div class="flex item-center gap-2 mb-4">
          <component :is="iconMap.warning" id="nc-selected-item-icon" class="text-yellow-500 w-10 h-10" />
          This action cannot be undone. Converting data types may result in data loss. Proceed with caution!
        </div>
      </div>

      <slot name="entity-preview"></slot>

      <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
        <NcButton type="secondary" @click="visible = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          key="submit"
          autofocus
          type="primary"
          html-type="submit"
          :loading="saving"
          data-testid="nc-delete-modal-delete-btn"
          @click="emit('submit')"
        >
          Update
          <template #loading> Saving... </template>
        </NcButton>
      </div>
    </div>
  </GeneralModal>
</template>
