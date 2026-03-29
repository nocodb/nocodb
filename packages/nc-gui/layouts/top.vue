<script lang="ts">
export default {
  name: 'TopLayout',
}
</script>

<template>
  <NuxtLayout class="nc-h-screen">
    <DashboardTopbar />
    <div class="h-full overflow-auto">
      <slot />
    </div>
  </NuxtLayout>
</template>
