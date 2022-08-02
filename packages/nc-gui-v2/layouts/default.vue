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
  name: 'Default',
}
</script>

<template>
  <a-layout-content class="pl-2 pt-2">
    <teleport v-if="$slots.sidebar" to="#sidebar">
      <slot name="sidebar" />
    </teleport>

    <slot />
  </a-layout-content>
</template>
