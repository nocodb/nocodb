<script setup lang="ts">
const { isEditingDashboard } = storeToRefs(useDashboardStore())
const { selectedWidget } = storeToRefs(useWidgetStore())

const finishEditing = () => {
  isEditingDashboard.value = false
  selectedWidget.value = null
}
</script>

<template>
  <div v-if="isEditingDashboard" class="flex gap-2 items-center justify-center">
    <NcButton type="secondary" size="small" @click="finishEditing"> Finish </NcButton>
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
