<script lang="ts" setup>
import { useTitle } from '@vueuse/core'
import { provideSidebar, useI18n, useRoute } from '#imports'

const route = useRoute()

const { te, t } = useI18n()

const { hasSidebar } = provideSidebar('nc-left-sidebar')

useTitle(route.meta?.title && te(route.meta.title) ? `${t(route.meta.title)} | NocoDB` : 'NocoDB')
</script>

<script lang="ts">
export default {
  name: 'DefaultLayout',
}
</script>

<template>
  <div class="w-full h-full flex">
    <Teleport :to="hasSidebar ? '#nc-sidebar-left' : null" :disabled="!hasSidebar">
      <slot name="sidebar" />
    </Teleport>

    <a-layout-content>
      <slot />
    </a-layout-content>
  </div>
</template>
