<script lang="ts" setup>
interface Props {
  rowCount: number
  rowHeight: number
  totalRowHeight: number
  colCount: number
}

const props = defineProps<Props>()

const background = computed(() => {
  return `repeating-linear-gradient(0deg,var(--nc-bg-default), var(--nc-bg-default) ${
    props.rowHeight - 1
  }px, var(--nc-bg-gray-medium) ${props.rowHeight}px)`
})

const height = computed(() => `${props.totalRowHeight}px`)
</script>

<template>
  <tr
    class="nc-grid-row"
    :style="{
      height,
    }"
  >
    <td
      :colspan="colCount"
      class="nc-grid-cell"
      :style="{
        background,
      }"
    ></td>
  </tr>
</template>
