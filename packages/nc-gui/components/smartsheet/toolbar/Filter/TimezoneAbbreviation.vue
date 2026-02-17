<script lang="ts" setup>
interface Props {
  column: any
  filter: any
}

const props = defineProps<Props>()

const timezoneAbbreviation = computed(() => {
  if (!props.column || !isDateType(props.column.uidt)) return null
  return getTimeZoneFromName(props.filter?.meta?.timezone)?.abbreviation
})
</script>

<template>
  <div
    v-if="timezoneAbbreviation"
    class="px-2 py-1 bg-nc-bg-gray-extralight text-nc-content-gray-muted text-xs border border-nc-border-gray-medium min-w-12 max-w-16 h-8 flex items-center justify-center"
  >
    {{ timezoneAbbreviation }}
  </div>
</template>
