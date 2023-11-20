<script lang="ts" setup>
import { iconMap } from '#imports'
</script>

<template>
  <a-dropdown :trigger="['click']" overlay-class-name="nc-dropdown-actions-menu">
    <a-button v-e="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn">
      <div class="flex gap-2 items-center">
        <component :is="iconMap.download" class="group-hover:text-accent text-gray-500" />
        <span class="text-capitalize !text-sm font-medium text-gray-500">{{ $t('general.download') }}</span>
        <component :is="iconMap.arrowDown" class="text-grey" />
      </div>
    </a-button>

    <template #overlay>
      <a-menu class="ml-6 !text-sm !px-0 !py-2 !rounded">
        <LazySmartsheetToolbarExportSubActions />
      </a-menu>
    </template>
  </a-dropdown>
</template>
