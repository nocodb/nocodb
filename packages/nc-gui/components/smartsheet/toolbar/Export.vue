<script setup lang="ts">
defineProps<{
  isInToolbar?: boolean
}>()

const { canDownload } = useViewExport()
</script>

<template>
  <NcDropdown v-if="canDownload" :trigger="['click']" overlay-class-name="nc-dropdown-actions-menu">
    <NcButton
      v-e="['c:actions']"
      class="nc-download-actions-menu-btn nc-toolbar-btn"
      :class="{
        '!border-0 !h-7': isInToolbar,
      }"
      :size="isInToolbar ? 'small' : 'xs'"
      type="secondary"
    >
      <div class="flex gap-2 items-center text-nc-content-gray-subtle">
        <component :is="iconMap.download" class="h-4 w-4" />
        <span class="text-capitalize !text-[13px] font-medium xs:hidden">{{ $t('general.download') }}</span>
      </div>
    </NcButton>

    <template #overlay>
      <NcMenu variant="small" class="ml-6 !text-sm !rounded-lg overflow-hidden">
        <LazySmartsheetToolbarExportSubActions />
      </NcMenu>
    </template>
  </NcDropdown>
</template>
