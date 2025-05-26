<script setup lang="ts">
const { isEditingDashboard } = storeToRefs(useDashboardStore())
</script>

<template>
  <div v-if="isEditingDashboard" class="flex gap-2 items-center justify-center">
    <NcButton type="secondary" size="small" @click="isEditingDashboard = false"> Cancel </NcButton>

    <NcButton type="secondary" class="!text-nc-content-brand" size="small"> Save changes </NcButton>
  </div>

  <div v-else class="flex gap-2 items-center justify-center">
    <NcButton type="secondary" size="small" @click="isEditingDashboard = true">
      <div class="flex gap-2 items-center">
        <GeneralIcon icon="ncEdit3" class="!h-4 !w-4" />
        Edit Dashboard
      </div>
    </NcButton>
  </div>
</template>

<style scoped lang="scss"></style>
