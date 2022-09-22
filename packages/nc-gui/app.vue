<script setup lang="ts">
import { computed, useRoute } from '#imports'

const route = useRoute()

const disableBaseLayout = computed(() => route.path.startsWith('/nc/view') || route.path.startsWith('/nc/form'))
</script>

<template>
  <a-config-provider>
    <NuxtLayout :name="disableBaseLayout ? false : 'base'">
      <NuxtPage keepalive :page-key="$route.fullPath.split('?')[0]" />
    </NuxtLayout>
  </a-config-provider>
</template>
