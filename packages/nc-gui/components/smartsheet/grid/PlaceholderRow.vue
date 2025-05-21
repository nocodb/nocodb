<script lang="ts" setup>
interface Props {
  rowCount: number
  rowHeight: number
  totalRowHeight: number
  colCount: number
}

const props = defineProps<Props>()

const background = computed(() => {
  return `repeating-linear-gradient(0deg,#FCFCFC, #FCFCFC ${props.rowHeight - 1}px, #E7E7E9 ${props.rowHeight}px)`
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
