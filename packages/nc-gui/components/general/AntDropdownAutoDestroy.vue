<script lang="ts" setup>
import { dropdownProps } from 'ant-design-vue/es/dropdown'
const props = defineProps(dropdownProps())
</script>

<template>
  <a-dropdown v-bind="props" :destroy-popup-on-hide="true">
    <slot />
    <template #overlay>
      <slot name="overlay" />
    </template>
  </a-dropdown>
</template>
