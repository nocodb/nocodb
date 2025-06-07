<script setup lang="ts">
const props = defineProps<{
  visible?: boolean
  saving?: boolean
}>();

const emit = defineEmits(['save', 'cancel', 'update:visible']);

const visible = useVModel(props, 'visible', emit);
</script>

<template>
  <NcModal v-model:visible="visible" size="small" :show-separator="false" :centered="false">
    <template #header>
      <div class="flex flex-row items-center gap-x-2">Unsaved Changes</div>
    </template>

    <div class="flex flex-col" @click.stop>
      <div class="text-gray-800 mb-3">
        <div class="flex item-center gap-2">
          <GeneralIcon id="nc-selected-item-icon" icon="alertTriangle" class="h-10 w-10 text-yellow-500" />
          You have unsaved changes. Would you like to save them before closing?
        </div>
      </div>

      <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
        <NcButton size="small" type="secondary" @click="emit('cancel')">
          No, Cancel
        </NcButton>

        <NcButton
          key="submit"
          autofocus
          size="small"
          type="primary"
          html-type="submit"
          :loading="saving"
          data-testid="nc-save-changes-btn"
          @click="emit('save')"
        >
          Yes, Save Changes
          <template #loading> Saving... </template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

