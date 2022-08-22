<script setup lang="ts">
import { computed, provideTheme, useRoute } from '#imports'

const route = useRoute()

const disableBaseLayout = computed(() => route.path.startsWith('/nc/view') || route.path.startsWith('/nc/form'))

const { theme } = provideTheme()
</script>

<template>
  <a-config-provider>
    <NuxtLayout :name="disableBaseLayout ? false : 'base'">
      <GeneralLoadingIndicator :color="theme.accentColor" />

      <NuxtPage />
    </NuxtLayout>
  </a-config-provider>
</template>
