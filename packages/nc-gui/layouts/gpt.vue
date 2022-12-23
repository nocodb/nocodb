<script lang="ts" setup>
import { computed, navigateTo, ref, useGlobal, useNuxtApp, useRoute, useSidebar } from '#imports'

const { signOut, signedIn, isLoading, user, currentVersion } = useGlobal()

useSidebar('nc-left-sidebar', { hasSidebar: false })

const route = useRoute()

const email = computed(() => user.value?.email ?? '---')

const hasSider = ref(false)

const sidebar = ref<HTMLDivElement>()

const logout = () => {
  signOut()
  navigateTo('/signin')
}

const { hooks } = useNuxtApp()

const isDashboard = computed(() => !!route.params.projectType)

/** when page suspensions have finished, check if a sidebar element was teleported into the layout */
hooks.hook('page:finish', () => {
  if (sidebar.value) {
    hasSider.value = sidebar.value?.children.length > 0
  }
})
</script>

<script lang="ts">
export default {
  name: 'DocsLayout',
}
</script>

<template>
  <!-- TODO: make header as a component -->
  <a-layout-header class="!px-2">
    <div class="flex w-full h-full items-center">
      <div class="flex-1 min-w-0 w-50">
        <img src="~/assets/img/brand/nocodb-full-color.png" class="h-12" />
      </div>

      <div class="flex-1 min-w-0 flex justify-end gap-2">
        <div class="nc-quick-action-wrapper">
          <MaterialSymbolsSearch class="nc-quick-action-icon" />
          <input class="" placeholder="Quick Actions" />

          <span class="nc-quick-action-shortcut">⌘ K</span>
        </div>

        <div class="flex items-center">
          <MdiBellOutline class="text-xl" />
          <MaterialSymbolsKeyboardArrowDownRounded />
        </div>
        <div class="flex items-center gap-1">
          <div class="h-14 w-14 rounded-full bg-primary flex items-center justify-center font-weight-bold text-white">AB</div>
          <MaterialSymbolsKeyboardArrowDownRounded />
        </div>
      </div>
    </div>
  </a-layout-header>
  <a-layout>
    <a-layout-header class="!bg-white">
      <slot name="header" />
    </a-layout-header>
    <a-layout-content class="px-4 py-4">
      <a-row>
        <a-col :span="12">
          <slot name="left" />
        </a-col>
        <a-col :span="12">
          <slot name="right" />
        </a-col>
      </a-row>
    </a-layout-content>
  </a-layout>
</template>

<style lang="scss">
.ant-layout-header {
  @apply !h-20 bg-transparent;
  border-bottom: 1px solid #f5f5f5;
}
</style>
