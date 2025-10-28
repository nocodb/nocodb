<script setup lang="ts">
import { ref, watch, toRefs } from 'vue'
import { useTextareaAutosize, type UseTextareaAutosizeOptions } from '@vueuse/core'

/**
 * Define props — you can extend this later if needed.
 */

interface Props {
  modelValue?: string
  disabled?: boolean
  placeholder?: string
  bordered?: boolean
  hideScrollbar?: boolean
  autoSizeProps?: Omit<UseTextareaAutosizeOptions, 'input'>
}

const props = withDefaults(defineProps<Props>(), {
  bordered: true,
  hideScrollbar: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'input', value: string): void
}>()

/**
 * Make props reactive — keeps modelValue in sync
 */
const { modelValue } = toRefs(props)
const value = ref(modelValue.value ?? '')

/**
 * Auto-resize logic from @vueuse/core
 */
const { textarea, input } = useTextareaAutosize({
  input: value,
  ...(props.autoSizeProps || {}),
})

/**
 * Keep v-model two-way bound
 */
watch(value, (val) => {
  emit('update:modelValue', val)
  emit('input', val)
})

watch(modelValue, (val) => {
  if (val !== value.value) value.value = val ?? ''
})
</script>

<template>
  <textarea
    ref="textarea"
    v-bind="$attrs"
    v-model="input"
    :disabled="disabled"
    :placeholder="placeholder"
    class="nc-auto-size-textarea w-full resize-none"
    :class="{
      'nc-no-border': !bordered,
      'nc-hide-scrollbar': hideScrollbar,
    }"
  />
</template>
<style scoped lang="scss">
.nc-auto-size-textarea {
  &.nc-no-border {
    @apply !border-0 !border-none !outline-none !ring-0 focus:(!border-0 !outline-none !ring-0);
  }

  &.nc-hide-scrollbar {
    @apply overflow-hidden;

    -ms-overflow-style: none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
}
</style>
