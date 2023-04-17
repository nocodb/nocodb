<script lang="ts" setup>
import { CellClickHookInj, CurrentCellInj, createEventHook, ref } from '#imports'

const el = ref()

const cellClickHook = createEventHook()

provide(CellClickHookInj, cellClickHook)

provide(CurrentCellInj, el)
</script>

<template>
  <div ref="el" @click="cellClickHook.trigger($event)">
    <slot />
  </div>
</template>
