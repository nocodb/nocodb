<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useHead, useRoute } from '#imports'
import { useProject } from '~/composables'

const route = useRoute()

const { te, t } = useI18n()

const { isSharedBase } = useProject()

useHead({
  title: route.meta?.title && te(route.meta.title as string) ? `${t(route.meta.title as string)} | NocoDB` : 'NocoDB',
})
</script>

<script lang="ts">
export default {
  name: 'Default',
}
</script>

<template>
  <div class="w-full h-full" :class="{ 'mb-10': isSharedBase }">
    <teleport v-if="$slots.sidebar" to="#nc-sidebar-left">
      <slot name="sidebar" />
    </teleport>

    <a-layout-content>
      <slot />
    </a-layout-content>
    <div v-if="isSharedBase" class="bg-white w-[100vw] h-[20px] fixed bottom-0 left-0 z-99 flex px-2 align-center border-t-1">
      <div class="flex-1" />
      <img src="~/public/favicon-32.png" class="h-[15px] mr-1" />
      <a href="https://github.com/nocodb/nocodb" target="_blank" class="text-xs text-primary/100">
        Powered by
        <span class="font-bold"> NocoDB </span>
      </a>
    </div>
  </div>
</template>
