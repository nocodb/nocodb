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
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: undefined,
  defaultSlotWrapper: true,
  defaultSlotWrapperClass: '',
})

const emits = defineEmits(['update:isOpen'])

// Controlled or uncontrolled pattern:
const isControlled = computed(() => props.isOpen !== undefined)

const innerIsOpen = ref(false)

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
</script>

<template>
  <NcDropdown v-model:visible="vModelIsOpen">
    <div
      v-if="defaultSlotWrapper"
      class="flex-1 border-1 border-nc-gray-medium rounded-lg h-8 px-3 py-1 flex items-center justify-between transition-all cursor-pointer select-none"
      :class="[
        defaultSlotWrapperClass,
        {
          'border-brand-500 shadow-selected': vModelIsOpen,
          'shadow-default hover:shadow-hover': !vModelIsOpen,
        },
      ]"
    >
      <slot name="default" :is-open="vModelIsOpen"> </slot>
    </div>
    <slot v-else name="default" :is-open="vModelIsOpen"> </slot>

    <template #overlay>
      <slot name="overlay" :isOpen="vModelIsOpen"></slot>
    </template>
  </NcDropdown>
</template>
