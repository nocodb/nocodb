<script lang="ts" setup>
interface Props {
  row?: Record<string, any>
  fromDate?: string
  toDate?: string
  color?: string
  showDate?: boolean
  invalid?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  fromDate: '',
  color: 'gray',
  showDate: true,
  invalid: false,
})

const rowColorInfo = computed(() => {
  return extractRowBackgroundColorStyle(props.row as Row)
})
</script>

<template>
  <div
    class="border-1 cursor-pointer h-12.5 flex-none border-gray-200 flex gap-2 flex-col rounded-lg overflow-hidden"
    :style="rowColorInfo.rowBgColor"
  >
    <div class="flex relative items-center gap-2">
      <span
        :class="{
          'bg-maroon-500': props.color === 'maroon',
          'bg-blue-500': props.color === 'blue',
          'bg-green-500': props.color === 'green',
          'bg-yellow-500': props.color === 'yellow',
          'bg-pink-500': props.color === 'pink',
          'bg-purple-500': props.color === 'purple',
          'bg-gray-900': color === 'gray',
        }"
        class="block h-12 w-1"
        :style="rowColorInfo.rowLeftBorderColor"
      ></span>
      <slot name="image" />
      <div class="flex gap-1 py-1 flex-col">
        <span
          :class="{
            '!max-w-35': invalid,
          }"
          class="text-[13px] leading-4 max-w-56 font-medium truncate text-gray-800"
        >
          <slot />
        </span>
        <NcTooltip v-if="invalid" placement="left" class="top-1 absolute right-1">
          <NcBadge color="red" :border="false" class="!h-5">
            <div class="flex items-center gap-1">
              <GeneralIcon icon="warning" class="text-red-500 !h-4 !w-4" />

              <span class="font-normal text-xs"> Date Error </span>
            </div>
          </NcBadge>
          <template #title>
            Record with end date before the start date won't be displayed in the calendar. Update the end date to display the
            record.
          </template>
        </NcTooltip>
        <NcTooltip v-if="showDate" show-on-truncate-only class="text-xs font-medium truncate max-w-58 leading-4 text-gray-600">
          {{ fromDate }} {{ toDate ? ` - ${toDate}` : '' }}
          <template #title> {{ fromDate }} {{ toDate ? ` - ${toDate}` : '' }} </template>
        </NcTooltip>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
