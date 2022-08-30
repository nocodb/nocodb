<template>
  <a-dropdown :trigger="['click']">
    <a-button v-t="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn">
      <div class="flex gap-2 items-center">
        <MdiDownload class="group-hover:text-accent text-gray-500" />
        <span class="text-capitalize !text-sm font-weight-normal">Download</span>
        <MdiMenuDown class="text-grey" />
      </div>
    </a-button>

    <template #overlay>
      <a-menu class="ml-6 !text-sm !px-0 !py-2 !rounded">
        <SmartsheetToolbarExportSubActions />
      </a-menu>
    </template>
  </a-dropdown>
</template>
