<script setup lang="ts">
const props = defineProps<{
  visible?: boolean
  saving?: boolean
}>()

const emit = defineEmits(['submit', 'cancel', 'update:visible'])

const visible = useVModel(props, 'visible', emit)
</script>

<template>
  <NcModal v-model:visible="visible" size="small" :show-separator="false" :centered="false">
    <template #header>
      <div class="flex flex-row items-center gap-x-2">Field Type Change</div>
    </template>

    <div class="flex flex-col" @click.stop>
      <div
        class="text-gray-800"
        :class="{
          'mb-3': $slots['entity-preview'],
        }"
      >
        <div class="flex item-center gap-2">
          <GeneralIcon id="nc-selected-item-icon" icon="alertTriangle" class="h-10 w-10 text-yellow-500" />
          This action cannot be undone. Converting data types may result in data loss. Proceed with caution!
        </div>
      </div>

      <slot name="entity-preview"></slot>

      <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
        <NcButton size="small" type="secondary" @click="visible = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          key="submit"
          autofocus
          size="small"
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
  </NcModal>
</template>
