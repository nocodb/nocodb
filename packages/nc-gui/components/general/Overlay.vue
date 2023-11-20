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
  zIndex?: number
}

interface Emits {
  (event: 'update:modelValue', value: boolean): void

  (event: 'close'): void

  (event: 'open'): void
}

const { transition = true, teleportDisabled = false, inline = false, target, zIndex = 100, ...rest } = defineProps<Props>()

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
    <Transition :name="transition ? 'fade' : undefined" mode="out-in">
      <div
        v-show="!!vModel"
        v-bind="$attrs"
        :style="{ zIndex }"
        :class="[inline ? 'absolute' : 'fixed']"
        class="top-0 left-0 bottom-0 right-0"
      >
        <slot :is-open="vModel" />
      </div>
    </Transition>
  </teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
