<script setup lang="ts">
import { computed, useRoute, useTheme } from '#imports'

const route = useRoute()

const disableBaseLayout = computed(() => route.path.startsWith('/nc/view') || route.path.startsWith('/nc/form'))

useTheme()
</script>

<template>
  <a-config-provider>
    <NuxtLayout :name="disableBaseLayout ? false : 'base'">
      <NuxtPage />
    </NuxtLayout>
  </a-config-provider>
</template>
