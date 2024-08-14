<script lang="ts" setup>
export type Placement = 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight'

export type RawValueType = string | number


interface Props {
  value: RawValueType
  list: {
    value: RawValueType
    label: string
  }[]
}

interface Emits {
  (e: 'update:value', value: RawValueType): void
  (e: 'change', value: RawValueType): void
}


const emits = defineEmits<Emits>()

const props = withDefaults(defineProps<Props>(), {})
</script>

<template></template>

<style lang="scss" scoped></style>
