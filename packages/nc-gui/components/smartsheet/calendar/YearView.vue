<script setup lang="ts">
const { pageDate, selectedDate, selectedDateRange } = useCalendarViewStoreOrThrow()

const months = computed(() => {
  const date = new Date()
  const months = []
  for (let i = 0; i < 12; i++) {
    months.push(new Date(date.getFullYear(), i, selectedDate.value.getDate()))
  }
  return months
})
</script>

<template>
  <div class="grid justify-items-center gap-6 grid-cols-3 overflow-auto nc-scrollbar-md">
    <NcDateWeekSelector
      v-for="(month, index) in months"
      :key="month"
      v-model:page-date="months[index]"
      v-model:selected-date="selectedDate"
      disable-pagination
      class="max-w-[350px]"
    />
  </div>
</template>

<style scoped lang="scss"></style>
