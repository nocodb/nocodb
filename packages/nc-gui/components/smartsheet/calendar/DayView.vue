<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import { type Row, computed, ref } from '#imports'

interface Props {
  isEmbed?: boolean
  data?: Row[] | null
}

const props = withDefaults(defineProps<Props>(), {
  isEmbed: false,
  data: null,
})

const emit = defineEmits(['expand-record'])
const meta = inject(MetaInj, ref())
const fields = inject(FieldsInj, ref([]))

const data = toRefs(props).data

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

const { pageDate, selectedDate, calDataType, filteredData, calendarRange } = useCalendarViewStoreOrThrow()

const hours = computed(() => {
  const hours = []
  for (let i = 0; i < 24; i++) {
    hours.push(i)
  }
  return hours
})

const renderData = computed(() => {
  console.log(data.value)
  if (data.value) {
    return data.value
  }
  return filteredData.value
})
</script>

<template>
  <template v-if="filteredData && filteredData.length">
    <div
      v-if="calDataType === UITypes.Date"
      :class="{
        'h-calc(100vh-10.8rem) overflow-y-auto nc-scrollbar-md': !props.isEmbed,
        'border-r-1 h-full border-gray-200 hover:bg-gray-50 ': props.isEmbed,
      }"
      class="flex flex-col pt-3 gap-2 h-full w-full px-1"
    >
      <LazySmartSheetRow v-for="(record, rowIndex) in renderData" :row="record">
        <LazySmartsheetCalendarRecordCard
          :key="rowIndex"
          :date="record.row[calendarRange[0].fk_from_col.title]"
          :name="record.row[displayField.title]"
          color="blue"
          size="small"
          @click="emit('expand-record', record)"
        />
      </LazySmartSheetRow>
    </div>
    <div
      v-else-if="calDataType === UITypes.DateTime"
      :class="{
        'h-calc(100vh-10.8rem) overflow-y-auto nc-scrollbar-md': !props.isEmbed,
        'border-r-1 h-full border-gray-200 ': props.isEmbed,
      }"
      class="flex flex-col mt-3 gap-2 w-full px-1"
    ></div>
  </template>
  <div v-else-if="!data" class="w-full h-full flex text-md font-bold text-gray-500 items-center justify-center">
    No Records in this day
  </div>
</template>

<style lang="scss" scoped></style>
