<script lang="ts" setup>
const { selectedDate, activeDates } = useCalendarViewStoreOrThrow()

const months = computed(() => {
  const months = []
  for (let i = 0; i < 12; i++) {
    months.push(new Date(selectedDate.value.getFullYear(), i, 1))
  }
  return months
})
</script>

<template>
  <div class="flex flex-wrap gap-6 pb-4 items-center justify-center overflow-auto nc-scrollbar-md">
    <NcDateWeekSelector
      v-for="(_, index) in months"
      :key="index"
      v-model:active-dates="activeDates"
      v-model:page-date="months[index]"
      v-model:selected-date="selectedDate"
      class="max-w-[350px]"
      disable-pagination
    />
  </div>
</template>

<style lang="scss" scoped></style>
