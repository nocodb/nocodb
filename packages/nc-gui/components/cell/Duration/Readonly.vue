<script setup lang="ts">
interface Props {
  modelValue: number | string | null | undefined
}

const props = defineProps<Props>()

const column = inject(ColumnInj)

const durationType = computed(() => parseProp(column?.value?.meta)?.duration || 0)

const localState = computed(() => {
  return convertMS2Duration(props.modelValue, durationType.value)
})
</script>

<template>
  <div class="duration-cell-wrapper truncate">
    <span class="nc-cell-field"> {{ localState }}</span>
  </div>
</template>
