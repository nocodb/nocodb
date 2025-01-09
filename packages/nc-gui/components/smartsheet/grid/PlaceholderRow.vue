<script lang="ts" setup>
interface Props {
  rowCount: number
  rowHeight: number
  totalRowHeight: number
  colCount: number
}

defineProps<Props>()
</script>

<template>
  <tr
    class="nc-grid-row"
    :style="{
      height: `${totalRowHeight}px`,
    }"
  >
    <td
      :colspan="colCount"
      class="nc-grid-cell"
      :style="{
        background: `repeating-linear-gradient(0deg,#FCFCFC, #FCFCFC ${rowHeight - 1}px, #E7E7E9 ${rowHeight}px)`,
      }"
    ></td>
  </tr>
</template>
