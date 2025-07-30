<script lang="ts" setup>
const nuxtLoadingIndicatorRef = ref()

const router = useRouter()

const route = router.currentRoute

/**
 * Manually call `finish()` on NuxtLoadingIndicator when `[...slugs]` route param is active.
 *
 * 🔍 Why:
 * Nuxt automatically starts and finishes the loading indicator based on route navigation.
 * However, in our case, the `[...slugs]` route is a placeholder that renders nothing.
 * Instead, rendering and data fetching happen earlier inside the `[viewTitle].vue` file,
 * which means by the time Nuxt reaches `[...slugs]`, there's no new work to trigger `finish()`.
 *
 * This causes the built-in loading indicator to remain indefinitely visible on these routes.
 *
 * ✅ Fix:
 * We watch both `viewTitle` and `slugs` params. Once either is present, we know we're on a deeply nested route,
 * and we manually call `.finish()` on the indicator to forcefully hide it.
 *
 * Reference path: packages/nc-gui/pages/index/[typeOrId]/[baseId]/index/index/[viewId]/[[viewTitle]]/[...slugs].vue
 */
watch(
  [() => route.value.params.viewTitle, () => route.value.params.slugs, () => route.value.query],
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
