<script lang="ts" setup>
withDefaults(defineProps<{ error: Record<string, any> }>(), { error: () => ({}) })
</script>

<template>
  <GeneralPageDoesNotExist>
    <template #title>
      {{
        error.statusCode !== 404 ? '404 - Page Not Found' : error.statusMessage ?? error.message ?? `Error ${error.statusCode}`
      }}
    </template>
  </GeneralPageDoesNotExist>
</template>
