<script lang="ts" setup>
import { onKeyStroke } from '#imports'

const props = withDefaults(
  defineProps<{
    trigger?: Array<'click' | 'hover' | 'contextmenu'>
    visible?: boolean | undefined
    overlayClassName?: string | undefined
    autoClose?: boolean
  }>(),
  {
    trigger: () => ['click'],
    visible: undefined,
    overlayClassName: undefined,
    autoClose: true,
  },
)

const emits = defineEmits(['update:visible'])

const trigger = toRef(props, 'trigger')

const overlayClassName = toRef(props, 'overlayClassName')

const autoClose = computed(() => props.autoClose)

const overlayClassNameComputed = computed(() => {
  let className = 'nc-dropdown bg-white rounded-lg border-1 border-gray-100 shadow-xl shadow-gray-200'
  if (overlayClassName.value) {
    className += ` ${overlayClassName.value}`
  }
  return className
})

const visible = useVModel(props, 'visible', emits)

onKeyStroke('Escape', () => {
  if (visible.value && autoClose.value) {
    visible.value = false
  }
})

const overlayWrapperDomRef = ref<HTMLElement | null>(null)

onClickOutside(overlayWrapperDomRef, () => {
  if (!autoClose.value) return

  visible.value = false
})
</script>

<template>
  <a-dropdown
    :visible="visible"
    :trigger="trigger"
    :overlay-class-name="overlayClassNameComputed"
    @update:visible="visible !== undefined ? (visible = $event) : undefined"
  >
    <slot />

    <template #overlay>
      <slot ref="overlayWrapperDomRef" name="overlay" />
    </template>
  </a-dropdown>
</template>

<style scoped>
.shadow-dropdown {
  box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1) !important;
}
</style>
