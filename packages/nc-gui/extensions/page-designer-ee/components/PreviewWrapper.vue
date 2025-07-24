<script lang="ts" setup>
provide(IsFormInj, ref(false))

const injectedExtensionConfig = inject(ExtensionConfigInj, ref({}))

const previewConfig = computed(() => {
  return {
    ...injectedExtensionConfig.value,
    isPageDesignerPreviewPanel: true,
  }
})

// Scoped re-provide for preview mode subtree
provide(ExtensionConfigInj, previewConfig)
</script>

<template>
  <slot />
</template>
