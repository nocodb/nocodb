<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const emit = defineEmits(['expand-record'])

const { pageDate, selectedDate, calDataType } = useCalendarViewStoreOrThrow()

const events = ref([
  {
    Id: 1,
    Title: 'Event 01',
    from_date_time: '2023-12-15',
    to_date_time: '2023-12-20',
  },
  {
    Id: 2,
    Title: 'Event 02',
    from_date_time: '2023-12-20',
    to_date_time: '2023-12-25',
  },
])
</script>

<template>
  <div v-if="calDataType === UITypes.Date" class="flex flex-col px-2 gap-4 pt-4">
    <LazySmartsheetCalendarRecordCard
      v-for="event in events"
      :key="event.Id"
      :name="event.Title"
      :date="event.from_date_time"
      color="blue"
      size="medium"
      @click="emit('expand-record', 'xxx')"
    />
  </div>
</template>

<style scoped lang="scss"></style>
