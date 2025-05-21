<script lang="ts" setup>
const props = defineProps<{
  active?: boolean
}>()

const { active } = toRefs(props)

const el = ref<HTMLElement>()

const cellClickHook = createEventHook()

const cellEventHook = createEventHook()

provide(CellClickHookInj, cellClickHook)

provide(CellEventHookInj, cellEventHook)

provide(CurrentCellInj, el)

const handleClick = (event: MouseEvent) => {
  cellClickHook.trigger(event)
  cellEventHook.trigger(event)
}

useActiveKeydownListener(
  active,
  (event) => {
    cellEventHook.trigger(event)
  },
  {
    isGridCell: true,
    immediate: true,
  },
)
</script>

<template>
  <td ref="el" class="select-none" @click="handleClick">
    <slot />
  </td>
</template>
