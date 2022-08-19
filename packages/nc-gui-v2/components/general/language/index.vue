<script lang="ts" setup>
import Menu from './Menu.vue'

const { subMenu } = defineProps<{ subMenu?: boolean }>()
</script>

<template>
  <template v-if="subMenu">
    <Menu />
  </template>
  <a-dropdown v-else class="select-none color-transition" :trigger="['click']">
    <MaterialSymbolsTranslate v-bind="$attrs" class="md:text-xl cursor-pointer nc-menu-translate" />

    <template #overlay>
      <Menu />
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
