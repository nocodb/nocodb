<template>
  <a-dropdown :trigger="['click']" overlay-class-name="nc-dropdown-actions-menu">
    <a-button v-e="['c:actions']" class="nc-actions-menu-btn nc-toolbar-btn dark:bg-slate-700">
      <div class="flex gap-2 items-center dark:text-slate-300">
        <MdiDownload class="group-hover:text-accent text-gray-500 dark:text-slate-300" />
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
