<script setup lang="ts">
import { type UseTextareaAutosizeOptions, useTextareaAutosize } from '@vueuse/core'

/**
 * Define props — you can extend this later if needed.
 */

interface Props {
  modelValue?: string | number | null
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
}>()

/**
 * Make props reactive — keeps modelValue in sync
 */
const { modelValue } = toRefs(props)
const value = ref(modelValue.value?.toString() ?? '')

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
})

watch(modelValue, (val) => {
  if (val !== value.value) value.value = val ?? ''
})

// ✅ expose textarea DOM element directly
defineExpose({
  $el: textarea,
  focus: () => textarea.value?.focus(),
  blur: () => textarea.value?.blur(),
  select: () => textarea.value?.select(),
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
  vertical-align: middle;
  transition-property: border, box-shadow;

  @apply !outline-none !ring-0 focus:(!outline-none !ring-0) duration-300;

  &.nc-no-border {
    @apply !border-0 !border-none focus:(!border-0);
  }

  &:not(.nc-no-border) {
    @apply border-1 border-nc-border-gray-medium focus:(border-nc-border-brand shadow-selected);
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
