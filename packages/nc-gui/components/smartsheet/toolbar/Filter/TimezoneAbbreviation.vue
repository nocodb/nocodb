<script lang="ts" setup>
interface Props {
  column: any
  filter: any
}

const props = defineProps<Props>()

const timezoneAbbreviation = computed(() => {
  if (!props.column || !isDateType(props.column.uidt)) return null
  const filterTimezone = props.filter?.meta?.timezone
  const timezone = filterTimezone
  return getTimeZoneFromName(timezone)?.abbreviation
})
</script>

<template>
  <div
    v-if="timezoneAbbreviation"
    class="px-2 py-1 bg-gray-50 text-gray-500 text-xs border border-gray-200 min-w-12 max-w-16 h-8 flex items-center justify-center"
  >
    {{ timezoneAbbreviation }}
  </div>
</template>
