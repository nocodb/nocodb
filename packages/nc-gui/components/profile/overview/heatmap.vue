<script lang="ts">
import { defineComponent } from 'vue'
import { CalendarHeatmap } from 'vue3-calendar-heatmap'

export default defineComponent({
  components: {
    CalendarHeatmap,
  },
})
</script>

<template>
  <CalendarHeatmap
    :values="[
      { date: '2022-12-16', count: 1 },
      { date: '2022-06-16', count: 1 },
      { date: '2022-11-16', count: 6 },
    ]"
    :end-date="new Date(new Date().getFullYear(), 11, 31)"
    no-data-text="No Activity Today"
    :round="3"
  />
</template>

<style lang="scss">
.vch__months__labels__wrapper text.vch__month__label {
  font-size: 10px;
}
.vch__days__labels__wrapper text.vch__day__label,
.vch__legend__wrapper text {
  font-size: 9px;
}
</style>
