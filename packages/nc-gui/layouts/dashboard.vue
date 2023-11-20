<script lang="ts" setup>
const router = useRouter()
const route = router.currentRoute
</script>

<script lang="ts">
export default {
  name: 'DashboardLayout',
}
</script>

<template>
  <NuxtLayout>
    <slot v-if="!route.meta.hasSidebar" name="content" />

    <LazyDashboardView v-else>
      <template #sidebar>
        <slot name="sidebar" />
      </template>
      <template #content>
        <slot name="content" />
      </template>
    </LazyDashboardView>
  </NuxtLayout>
</template>
