<script lang="ts" setup>
import { useTitle } from '@vueuse/core'
import { useI18n, useRoute, useSidebar } from '#imports'

const route = useRoute()

const { te, t } = useI18n()

const { hasSidebar } = useSidebar('nc-left-sidebar')

useTitle(route.meta?.title && te(route.meta.title) ? `${t(route.meta.title)} | NocoDB` : 'NocoDB')
</script>

<script lang="ts">
export default {
  name: 'DefaultLayout',
}
</script>

<template>
  <div class="w-full h-full">
    <Teleport :to="hasSidebar ? '#nc-sidebar-left' : null" :disabled="!hasSidebar">
      <slot name="sidebar" />
    </Teleport>

    <a-layout-content>
      <slot />
    </a-layout-content>
  </div>
</template>
