<script setup lang="ts">
interface Props {
  isOpen?: boolean
  /**
   * If true, the default slot will be wrapped in a div with border.
   */
  defaultSlotWrapper?: boolean
  /**
   * Class to be applied to the default slot wrapper.
   */
  defaultSlotWrapperClass?: string
  disabled?: boolean
  borderOnHover?: boolean
  hasError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: undefined,
  defaultSlotWrapper: true,
  defaultSlotWrapperClass: '',
  disabled: false,
  borderOnHover: false,
  hasError: false,
})

const emits = defineEmits(['update:isOpen'])

const { disabled } = toRefs(props)

// Controlled or uncontrolled pattern:
const isControlled = computed(() => props.isOpen !== undefined)

const innerIsOpen = ref(false)

const triggerRef = ref<HTMLElement | null>(null)

const vModelIsOpen = computed({
  get() {
    return isControlled.value ? !!props.isOpen : innerIsOpen.value
  },
  set(value: boolean) {
    if (isControlled.value) {
      emits('update:isOpen', value)
    } else {
      innerIsOpen.value = value
    }
  },
})

const onEsc = (_e: KeyboardEvent) => {
  nextTick(() => {
    triggerRef.value?.focus()
  })
}

const onEnter = (e: KeyboardEvent) => {
  if (disabled.value || vModelIsOpen.value) return

  e.preventDefault()
  e.stopPropagation()

  vModelIsOpen.value = true
}

/**
 * On close dropdown it's important to focus the trigger element so that tabbing works as expected
 */
watch(vModelIsOpen, (newVal) => {
  if (newVal) return

  nextTick(() => {
    triggerRef.value?.focus()
  })
})
</script>

<template>
  <NcDropdown v-model:visible="vModelIsOpen" :disabled="disabled">
    <div
      tabindex="0"
      v-if="defaultSlotWrapper"
      class="nc-list-dropdown-wrapper border-1 rounded-lg h-8 px-3 py-1 flex items-center justify-between transition-all select-none outline-none"
      :class="[
        defaultSlotWrapperClass,
        {
          'cursor-not-allowed bg-nc-bg-gray-extralight text-nc-content-gray-muted': disabled,
          'cursor-pointer': !disabled,
          'border-brand-500 shadow-selected': vModelIsOpen && !disabled && !hasError,
          'border-error shadow-error': vModelIsOpen && !disabled && hasError,
          'nc-list-dropdown-wrapper-default-state': !vModelIsOpen && !disabled && !borderOnHover,
          'hover:(border-brand-500 shadow-selected)': vModelIsOpen && !disabled && borderOnHover,
          'hover:(shadow-default hover:shadow-hover)': !vModelIsOpen && !disabled && borderOnHover,
          'border-transparent hover:(border-nc-gray-medium)': (borderOnHover || vModelIsOpen) && !disabled,
          'border-nc-gray-medium': !borderOnHover && !hasError,
          'border-error': !borderOnHover && hasError,
        },
      ]"
      @keydown.enter.exact="onEnter"
    >
      <button
        ref="triggerRef"
        type="button"
        tabindex="-1"
        class="sr-only outline-none ring-0 shadow-none focus:(outline-none shadow-none)"
      ></button>

      <slot name="default" :is-open="vModelIsOpen"> </slot>
    </div>
    <div v-else :class="defaultSlotWrapperClass">
      <button
        ref="triggerRef"
        type="button"
        tabindex="-1"
        class="sr-only outline-none ring-0 shadow-none focus:(outline-none shadow-none)"
      ></button>

      <slot name="default" :is-open="vModelIsOpen"> </slot>
    </div>

    <template #overlay>
      <slot name="overlay" :is-open="vModelIsOpen" :on-close="() => (vModelIsOpen = false)" :on-esc="onEsc"></slot>
    </template>
  </NcDropdown>
</template>

<style scoped lang="scss">
.nc-list-dropdown-wrapper {
  &.nc-list-dropdown-wrapper-default-state {
    @apply shadow-default;

    &:not(:focus-visible):not(:focus-within):not(:focus) {
      @apply hover:shadow-hover;
    }

    &:focus-visible,
    &:focus-within,
    &:focus {
      @apply border-brand-500 shadow-selected outline-none;
    }
  }
}
</style>
