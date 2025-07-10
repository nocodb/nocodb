<script setup lang="ts">
const { isEditingDashboard } = storeToRefs(useDashboardStore())
</script>

<template>
  <div v-if="isEditingDashboard" class="flex items-center text-nc-content-brand leading-5 font-normal">
    You are now editing this dashboard
  </div>
</template>

<style scoped lang="scss"></style>
