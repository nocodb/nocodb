<script lang="ts" setup>
import { navigateTo } from '#app'
</script>

<script lang="ts">
export default {
  name: 'SharedView',
}
</script>

<template>
  <a-layout id="nc-app">
    <a-layout class="!flex-col">
      <a-layout-header class="flex !bg-primary items-center text-white pl-1 pr-4 shadow-lg">
        <div class="transition-all duration-200 p-2 cursor-pointer transform hover:scale-105" @click="navigateTo('/')">
          <img width="35" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
        </div>

        <div class="flex-1" />

        <a-tooltip placement="left">
          <template #title> Switch language </template>

          <div class="flex pr-4 items-center">
            <GeneralLanguage class="cursor-pointer text-2xl" />
          </div>
        </a-tooltip>
      </a-layout-header>

      <div class="w-full overflow-hidden" style="height: calc(100% - var(--header-height))">
        <slot />
      </div>
    </a-layout>
  </a-layout>
</template>

<style lang="scss" scoped>
:deep(.ant-dropdown-menu-item-group-title) {
  @apply border-b-1;
}

:deep(.ant-dropdown-menu-item-group-list) {
  @apply m-0;
}
</style>
