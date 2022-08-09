<script lang="ts" setup>
import { breakpointsTailwind } from '@vueuse/core'
import { navigateTo } from '#app'
import { computed, useBreakpoints, useGlobal, useProject, useRoute } from '#imports'

/** get current breakpoints (for enabling sidebar) */
const breakpoints = useBreakpoints(breakpointsTailwind)

const { signOut, isLoading, user } = useGlobal()

const { project } = useProject()

const route = useRoute()

const email = computed(() => user.value?.email ?? '---')

const logout = () => {
  signOut()
  navigateTo('/signin')
}
</script>

<template>
  <a-layout>
    <slot name="sidebar" />

    <a-layout class="!flex-col">
      <a-layout-header class="flex !bg-primary items-center text-white !px-[1px] shadow-lg">
        <slot name="header-start" />

        <div id="header-start" class="w-[250px] flex items-center px-1 h-full" />

        <div class="hidden flex justify-center">
          <div v-show="isLoading" class="flex items-center gap-2 ml-3">
            {{ $t('general.loading') }}
            <MdiReload :class="{ 'animate-infinite animate-spin': isLoading }" />
          </div>
        </div>

        <div class="flex-1" />

        <a-tooltip placement="right">
          <template #title> Switch language </template>

          <div class="flex pr-4 items-center">
            <GeneralLanguage class="cursor-pointer text-2xl" />
          </div>
        </a-tooltip>
      </a-layout-header>

      <div class="w-full h-full">
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
