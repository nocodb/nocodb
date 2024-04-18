<script setup lang="ts">
interface Prop {
  extensionId: string
}

const { extensionId } = defineProps<Prop>()
</script>

<template>
  <NuxtErrorBoundary>
    <ExtensionsExtension :extension-id="extensionId" />
    <template #error="{ error }">
      <ExtensionsExtension :extension-id="extensionId" :error="error" />
    </template>
  </NuxtErrorBoundary>
</template>

<style lang="scss">
.extension-wrapper {
  @apply bg-white rounded-lg p-2 w-full border-1;
}

.extension-header {
  @apply flex justify-between;

  .extension-header-left {
    @apply flex items-center gap-2;
  }

  .extension-header-right {
    @apply flex items-center gap-4;
  }

  .extension-title {
    @apply font-weight-600;
  }
}

.extension-content {
  @apply border-1 m-2 p-2 rounded-lg;
}
</style>
