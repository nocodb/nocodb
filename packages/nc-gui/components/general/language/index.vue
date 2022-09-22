<template>
  <a-dropdown
    class="select-none color-transition cursor-pointer"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-menu-translate"
  >
    <div v-bind="$attrs" class="flex items-center justify-center">
      <MaterialSymbolsTranslate class="md:text-xl nc-menu-translate" />
    </div>

    <template #overlay>
      <a-menu class="scrollbar-thin-dull min-w-50 max-h-90vh overflow-auto !py-0 rounded">
        <GeneralLanguageMenu />
      </a-menu>
    </template>
  </a-dropdown>
</template>
