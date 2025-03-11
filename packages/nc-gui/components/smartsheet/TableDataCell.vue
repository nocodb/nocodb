<script lang="ts" setup>
const el = ref<HTMLElement>()

const cellClickHook = createEventHook()

const cellEventHook = createEventHook()

provide(CellClickHookInj, cellEventHook)

provide(CellEventHookInj, cellEventHook)

provide(CurrentCellInj, el)

const handleClick = (event: MouseEvent) => {
  cellClickHook.trigger(event)
  cellEventHook.trigger(event)
}
</script>

<template>
  <td ref="el" class="select-none" @click="handleClick" @keydown="cellEventHook.trigger($event)">
    <slot />
  </td>
</template>
