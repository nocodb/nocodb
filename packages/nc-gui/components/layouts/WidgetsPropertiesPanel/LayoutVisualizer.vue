<script lang="ts" setup>
import { defineProps } from 'vue'
import { SelectedLayoutDimension } from '../types'

const props = defineProps<{
  selectedLayoutDimension: SelectedLayoutDimension
}>()

const { selectedLayoutDimension } = toRefs(props)
</script>

<template>
  <!-- TODO: improve: find out how to use dynamic asset paths -->
  <img
    :class="{ hidden: selectedLayoutDimension !== SelectedLayoutDimension.None }"
    src="~/assets/img/dashboards/layout-visualizer/none.svg"
  />
  <img
    :class="{ hidden: selectedLayoutDimension !== SelectedLayoutDimension.Vertical }"
    src="~/assets/img/dashboards/layout-visualizer/vertical.svg"
  />
  <img
    :class="{ hidden: selectedLayoutDimension !== SelectedLayoutDimension.Horizontal }"
    src="~/assets/img/dashboards/layout-visualizer/horizontal.svg"
  />
  <img
    :class="{ hidden: selectedLayoutDimension !== SelectedLayoutDimension.Gap }"
    src="~/assets/img/dashboards/layout-visualizer/gap.svg"
  />
</template>

<style scoped>
img {
  @apply w-full h-full bg-transparent;
}
</style>
