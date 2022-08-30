<script setup lang="ts">
import '@purge-icons/generated'

import { computed, provideTheme, useRoute } from '#imports'

const route = useRoute()

const disableBaseLayout = computed(() => route.path.startsWith('/nc/view') || route.path.startsWith('/nc/form'))

provideTheme()
</script>

<template>
  <a-config-provider>
    <NuxtLayout :name="disableBaseLayout ? false : 'base'">
      <NuxtPage />
    </NuxtLayout>
  </a-config-provider>
</template>
