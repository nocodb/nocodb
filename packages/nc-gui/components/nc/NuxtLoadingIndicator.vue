<script lang="ts" setup>
const nuxtLoadingIndicatorRef = ref()

const router = useRouter()

const route = router.currentRoute

/**
 * Manually call `finish()` on NuxtLoadingIndicator when `slugs` route param is active.
 *
 * Why:
 * Nuxt automatically triggers the loading indicator when navigating to dynamic routes.
 * In our case, the `[...slugs]` route is a placeholder and doesn't render anything directly.
 * The actual rendering and data fetching happens in the `[viewTitle].vue` file *before* Nuxt
 * fully resolves the `[...slugs]` route.
 *
 * As a result, Nuxt never auto-finishes the loading indicator, causing it to stay stuck.
 * To address this, we manually finish the indicator once `slugs` is detected.
 *
 * File ref: packages/nc-gui/pages/index/[typeOrId]/[baseId]/index/index/[viewId]/[[viewTitle]]/[...slugs].vue
 */
watch(
  [() => route.value.params.viewTitle, () => route.value.params.slugs],
  async ([viewTitle, slugs]) => {
    if (!viewTitle && ncIsUndefined(slugs)) return

    await until(() => !!nuxtLoadingIndicatorRef.value).toBeTruthy()

    forcedNextTick(() => {
      nuxtLoadingIndicatorRef.value?.finish()
    })
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <!-- This uses the built-in NuxtLoadingIndicator with exposed API -->
  <NuxtLoadingIndicator ref="nuxtLoadingIndicatorRef" color="#3366FF" error-color="#E8463C" />
</template>
