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
  <div class="nc-profile-heatmap-container">
    <div class="mt-2 mb-5 text-[15px]"><span class="font-bold">122</span> contributions in the last year</div>
    <CalendarHeatmap
      :values="[
        { date: '2022-12-16', count: 1 },
        { date: '2022-06-16', count: 3 },
        { date: '2022-11-16', count: 6 },
      ]"
      :end-date="new Date(new Date().getFullYear(), 11, 31)"
      no-data-text="No Activity Today"
      :round="3"
    />
  </div>
</template>

<style lang="scss">
// TODO: these styles are supposed from the library
.vch__container {
  .vch__legend {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-right: 25px;
  }
  .vch__external-legend-wrapper {
    margin: 0 8px;
  }
}
svg.vch__wrapper {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue',
    sans-serif;
  line-height: 10px;
  width: 100%;
  .vch__months__labels__wrapper text.vch__month__label {
    font-size: 10px;
  }
  .vch__days__labels__wrapper text.vch__day__label,
  .vch__legend__wrapper text {
    font-size: 9px;
  }
  text.vch__month__label,
  text.vch__day__label,
  .vch__legend__wrapper text {
    fill: #767676;
  }
  rect.vch__day__square:hover {
    stroke: #555;
    stroke-width: 2px;
    paint-order: stroke;
  }
  rect.vch__day__square:focus {
    outline: none;
  }
  &.dark-mode {
    text.vch__month__label,
    text.vch__day__label,
    .vch__legend__wrapper text {
      fill: #fff;
    }
  }
}
</style>
