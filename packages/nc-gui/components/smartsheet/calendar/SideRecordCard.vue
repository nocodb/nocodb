<script lang="ts" setup>
interface Props {
  fromDate?: string
  toDate?: string
  color?: string
  showDate?: boolean
  invalid?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  fromDate: '',
  color: 'blue',
  showDate: true,
  invalid: false,
})
</script>

<template>
  <div class="border-1 cursor-pointer min-h-14 border-gray-200 p-2 flex gap-2 flex-col rounded-lg">
    <div class="flex items-center gap-2">
      <span
        :class="{
          'bg-maroon-500': props.color === 'maroon',
          'bg-blue-500': props.color === 'blue',
          'bg-green-500': props.color === 'green',
          'bg-yellow-500': props.color === 'yellow',
          'bg-pink-500': props.color === 'pink',
          'bg-purple-500': props.color === 'purple',
        }"
        class="block h-10 w-1 rounded"
      ></span>
      <slot name="image" />
      <div class="flex gap-1 flex-col">
        <span class="text-[13px] leading-4 max-w-56 font-medium truncate text-gray-800">
          <slot />
        </span>
        <span v-if="showDate" class="text-xs font-medium leading-4 text-gray-600"
          >{{ fromDate }} {{ toDate ? ` - ${toDate}` : '' }}</span
        >
      </div>
    </div>

    <NcTooltip v-if="invalid">
      <div class="gap-3 bg-yellow-50 mt-2 border-gray-200 border-1 rounded-lg p-2 flex">
        <GeneralIcon icon="warning" class="text-yellow-500 !h-5 !w-5" />
        <div class="text-gray-700 text-xs">Selected End date is before Start date.</div>
      </div>
      <template #title>
        Record with end date before the start date won't be displayed in the calendar. Update the end date to display the record.
      </template>
    </NcTooltip>
  </div>
</template>

<style lang="scss" scoped></style>
