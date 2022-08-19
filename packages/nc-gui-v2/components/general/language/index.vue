<template>
  <a-dropdown class="select-none color-transition" :trigger="['click']">
    <MaterialSymbolsTranslate v-bind="$attrs" class="md:text-xl cursor-pointer nc-menu-translate" />

    <template #overlay>
      <a-menu class="scrollbar-thin-dull min-w-50 max-h-90vh overflow-auto !py-0 rounded">
        <GeneralLanguageMenu />
      </a-menu>
    </template>
  </a-dropdown>
</template>
