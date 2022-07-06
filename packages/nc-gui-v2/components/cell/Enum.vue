<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { inject } from 'vue'
import { enumColor } from '~/utils/colorsUtils'

const colors = enumColor.light

const value = inject('value')
const column = inject<ColumnType>('column')
</script>

<template>
  <div>
    <span
      v-for="v in [(value || '').replace(/\\'/g, '\'').replace(/^'|'$/g, '')]"
      :key="v"
      :style="{
        background: colors[v],
      }"
      class="set-item ma-1 py-1 px-3"
      >{{ v }}</span
    >
  </div>
</template>

<style scoped>
.set-item {
  display: inline-block;
  border-radius: 25px;
  white-space: nowrap;
}
</style>
