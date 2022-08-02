<script lang="ts" setup>
import { onKeyDown } from '@vueuse/core'
import { useVModel, watch } from '#imports'

interface Props {
  modelValue?: any
}

interface Emits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'close'): void
  (event: 'open'): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'modelValue', emits)

onKeyDown('Escape', () => {
  vModel.value = false
})

watch(vModel, (nextVal) => {
  if (nextVal) emits('open')
  else emits('close')
})
</script>

<template>
  <teleport to="body">
    <div
      :class="[vModel ? 'opacity-100' : 'opacity-0 pointer-events-none']"
      class="transition-opacity duration-200 ease-in-out fixed z-100 top-0 left-0 bottom-0 right-0 bg-gray-700/75"
    >
      <slot :is-open="vModel" />
    </div>
  </teleport>
</template>
