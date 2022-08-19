<script setup lang="ts">
import { computed, themeV2Colors, useRoute, useTheme } from '#imports'

const route = useRoute()

const disableBaseLayout = computed(() => route.path.startsWith('/nc/view') || route.path.startsWith('/nc/form'))

useTheme({
  primaryColor: themeV2Colors['royal-blue'].DEFAULT,
  accentColor: themeV2Colors.pink['500'],
})
</script>

<template>
  <a-config-provider>
    <NuxtLayout :name="disableBaseLayout ? false : 'base'">
      <NuxtPage />
    </NuxtLayout>
  </a-config-provider>
</template>
