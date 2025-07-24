<script setup lang="ts">
interface Prop {
  extensionId: string
}

const { extensionId } = defineProps<Prop>()
</script>

<template>
  <NuxtErrorBoundary>
    <ExtensionsExtension :extension-id="extensionId" />
    <template #error="{ error, clearError }">
      <ExtensionsExtension :extension-id="extensionId" :error="error" :clearError="clearError" />
    </template>
  </NuxtErrorBoundary>
</template>
