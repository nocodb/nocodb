<script lang="ts">
export default {
  name: 'TopLayout',
}
</script>

<template>
  <NuxtLayout class="h-screen">
    <DashboardTopbar />
    <div class="h-full overflow-auto">
      <slot></slot>
    </div>
  </NuxtLayout>
</template>
