<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
  tableId: string
  title?: string
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)
</script>

<template>
  <NcModal v-model:visible="visible" size="large" :show-separator="false" wrap-class-name="nc-modal-column-visibility">
    <div class="flex flex-col h-[70vh]">
      <div class="flex items-center justify-between px-6 py-4 border-b-1 border-gray-200 flex-shrink-0">
        <h3 class="text-lg font-semibold text-gray-900">
          {{ $t('labels.columnVisibility') }}
          <span v-if="title" class="text-gray-500 font-normal"> - {{ title }}</span>
        </h3>
        <NcButton type="text" size="small" @click="visible = false">
          <GeneralIcon icon="close" class="text-gray-500" />
        </NcButton>
      </div>
      <div class="flex-1 overflow-hidden p-6">
        <DashboardSettingsColumnUIAcl :table-id="tableId" class="h-full" />
      </div>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
:deep(.nc-modal-column-visibility) {
  .ant-modal {
    @apply !top-[50px];
  }
  .ant-modal-content {
    @apply !p-0;
    max-height: calc(100vh - 100px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
}
</style>
