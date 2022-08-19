<script lang="ts" setup>
const { subMenu } = defineProps<{ subMenu?: boolean }>()
</script>

<template>
  <GeneralLanguageMenu v-if="subMenu" />

  <a-dropdown v-else class="select-none color-transition" :trigger="['click']">
    <MaterialSymbolsTranslate v-bind="$attrs" class="md:text-xl cursor-pointer nc-menu-translate" />

    <template #overlay>
      <GeneralLanguageMenu />
    </template>
  </a-dropdown>
</template>

<style scoped>
:deep(.ant-dropdown-menu-item-group-list) {
  @apply !mx-0;
}

:deep(.ant-dropdown-menu-item-group-title) {
  @apply border-b-1;
}

:deep(.ant-dropdown-menu-item-group-list) {
  @apply m-0;
}

:deep(.ant-dropdown-menu-item) {
  @apply !py-0 active:(ring ring-pink-500);
}
</style>
