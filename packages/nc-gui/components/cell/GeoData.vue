<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import type { GeoLocationType } from 'nocodb-sdk'
import { EditModeInj, inject, ReadonlyInj, ref, useVModel } from '#imports'
import { onKeyDown } from '@vueuse/core'

interface Props {
  modelValue?: GeoLocationType
}

interface Emits {
  (event: 'update:modelValue', model: GeoLocationType): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const isOpen = ref(false)

const visible = ref<boolean>(false)

const editEnabled = inject(EditModeInj)

const readOnly = inject(ReadonlyInj)!

const vModel = useVModel(props, 'modelValue', emits)

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()

const toggleVisbility = () => {
  visible.value = !visible.value
}
</script>

<template>
  <div v-on:click="toggleVisbility" :style="{ minWidth: '100%', minHeight: '100%', backgroundColor: 'red' }">
    <a-popover v-model:visible="visible" title="Title" trigger="click">
      <template>
        <a-input />
        <a-input />
      </template>
    </a-popover>
  </div>
</template>

<style scoped lang="scss">
input[type='number']:focus {
  @apply ring-transparent;
}
</style>
