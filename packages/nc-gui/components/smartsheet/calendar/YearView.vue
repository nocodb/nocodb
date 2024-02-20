<script lang="ts" setup>
const { selectedDate, activeDates } = useCalendarViewStoreOrThrow()

const months = computed(() => {
  const months = []
  for (let i = 0; i < 12; i++) {
    months.push(new Date(selectedDate.value.getFullYear(), i, selectedDate.value.getDate()))
  }
  return months
})
</script>

<template>
  <div class="grid justify-items-center gap-6 grid-cols-3 overflow-auto nc-scrollbar-md">
    <NcDateWeekSelector
      v-for="(month, index) in months"
      :key="month"
      v-model:active-dates="activeDates"
      v-model:page-date="months[index]"
      v-model:selected-date="selectedDate"
      class="max-w-[350px]"
      disable-pagination
    />
  </div>
</template>

<style lang="scss" scoped></style>
