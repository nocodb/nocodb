<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useHead, useRoute } from '#imports'

const route = useRoute()

const { te, t } = useI18n()

useHead({
  title: route.meta?.title && te(route.meta.title as string) ? `${t(route.meta.title as string)} | NocoDB` : 'NocoDB',
})
</script>

<script lang="ts">
export default {
  name: 'DefaultLayout',
}
</script>

<template>
  <div class="w-full h-full">
    <Transition duration="5000" name="page">
      <Teleport to="#nc-sidebar-left">
        <slot name="sidebar" />
      </Teleport>
    </Transition>

    <a-layout-content>
      <slot />
    </a-layout-content>
  </div>
</template>
