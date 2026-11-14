<script lang="ts" setup>
interface Props {
  column: any
  filter: any
}

const props = defineProps<Props>()

const activeView = inject(ActiveViewInj, ref())

const timezoneAbbreviation = computed(() => {
  if (!props.column || !isDateType(props.column.filterUidt ?? props.column.uidt)) return null
  return getTimezoneAbbreviation(
    getEffectiveFilterTimezone(props.filter, props.column, getFilterRequestTimezone(activeView.value)),
  )
})
</script>

<template>
  <div
    v-if="timezoneAbbreviation"
    class="px-2 py-1 bg-nc-bg-gray-extralight text-nc-content-gray-muted text-xs border border-nc-border-gray-medium min-w-12 sm:max-w-16 h-8 flex items-center justify-center"
  >
    {{ timezoneAbbreviation }}
  </div>
</template>
