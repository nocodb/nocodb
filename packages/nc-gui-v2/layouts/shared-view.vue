<script lang="ts" setup>
import { navigateTo } from '#app'
const { isLoading } = useGlobal()
const { sharedView } = useSharedView()
</script>

<script lang="ts">
export default {
  name: 'SharedView',
}
</script>

<template>
  <a-layout id="nc-app">
    <a-layout class="!flex-col">
      <a-layout-header class="flex !bg-primary items-center text-white pl-3 pr-4 shadow-lg">
        <div class="transition-all duration-200 p-2 cursor-pointer transform hover:scale-105" @click="navigateTo('/')">
          <img width="35" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
        </div>
        <div>
          <div class="flex justify-center items-center">
            <div class="flex items-center gap-2 ml-3">
              <template v-if="isLoading">
                {{ $t('general.loading') }}

                <MdiReload :class="{ 'animate-infinite animate-spin': isLoading }" />
              </template>
              <div v-else class="text-xl font-semibold truncate">
                {{ sharedView?.title }}
              </div>
            </div>
          </div>
        </div>
        <div class="flex-1" />
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
