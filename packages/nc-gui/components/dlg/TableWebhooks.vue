<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits(['update:visible'])

const vVisible = useVModel(props, 'visible', emits)
</script>

<template>
  <NcModal v-model:visible="vVisible" size="lg" :show-separator="false" class="!p-0" wrap-class-name="nc-modal-table-webhooks">
    <div class="flex flex-col h-full">
      <div class="flex items-center gap-2 px-4 py-3 border-b-1 border-nc-border-gray-medium">
        <GeneralIcon icon="ncWebhook" class="w-5 h-5 text-nc-content-gray-subtle2" />
        <div class="flex-1 text-lg font-bold text-nc-content-gray-emphasis">{{ $t('objects.webhooks') }}</div>
        <NcButton size="small" type="text" @click="vVisible = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>

      <div class="flex-1 min-h-0 overflow-auto nc-scrollbar-thin">
        <LazySmartsheetDetailsWebhooks v-if="vVisible" in-modal />
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-table-webhooks {
  .nc-modal {
    @apply !p-0;
  }
}
</style>
