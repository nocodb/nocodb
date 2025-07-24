<script lang="ts" setup>
provide(IsFormInj, ref(false))

const injectedExtensionConfig = inject(ExtensionConfigInj)

const previewConfig = ref({
  ...injectedExtensionConfig?.value,
  isPageDesignerPreviewPanel: true,
})

// Scoped re-provide for preview mode subtree
provide(ExtensionConfigInj, previewConfig)
</script>

<template>
  <slot />
</template>
