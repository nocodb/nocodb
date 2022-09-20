<script lang="ts" setup>
import { onKeyDown } from '@vueuse/core'
import type { TeleportProps } from '@vue/runtime-core'
import { useVModel, watch } from '#imports'

interface Props {
  modelValue?: any
  /** if true, overlay will use `position: absolute` instead of `position: fixed` */
  inline?: boolean
  /** target to teleport to */
  target?: TeleportProps['to']
  teleportDisabled?: TeleportProps['disabled']
  transition?: boolean
  lightBackground?: boolean
}

interface Emits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'close'): void
  (event: 'open'): void
}

const { transition = true, teleportDisabled = false, inline = false, target, ...rest } = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(rest, 'modelValue', emits)

onKeyDown('Escape', () => {
  vModel.value = false
})

watch(vModel, (nextVal) => {
  if (nextVal) emits('open')
  else emits('close')
})
</script>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<template>
  <teleport :disabled="teleportDisabled || (inline && !target)" :to="target || 'body'">
    <div
      v-bind="$attrs"
      :class="[
        vModel ? 'opacity-100' : 'opacity-0 pointer-events-none',
        inline ? 'absolute' : 'fixed',
        transition ? 'transition-opacity duration-200 ease-in-out' : '',
        lightBackground ? 'bg-gray-100/25' : '',
        !lightBackground ? 'bg-gray-700/75' : '',
      ]"
      class="z-100 top-0 left-0 bottom-0 right-0 bg-gray-100/25"
    >
      <slot :is-open="vModel" />
    </div>
  </teleport>
</template>
