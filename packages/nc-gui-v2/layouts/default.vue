<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useHead, useRoute } from '#imports'

const route = useRoute()
const { t } = useI18n()

useHead({
  title: `${t(route.meta.title as string)} | NocoDB`,
})
</script>

<script lang="ts">
export default {
  name: 'Default',
}
</script>

<template>
  <v-main>
    <slot name="sidebar">
      <div id="sidebar" />
    </slot>

    <slot />
  </v-main>
</template>
