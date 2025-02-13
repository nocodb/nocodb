<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    trigger?: Array<'click' | 'hover' | 'contextmenu'>
    visible?: boolean | undefined
    overlayClassName?: string | undefined
    overlayStyle?: Record<string, any>
    disabled?: boolean
    placement?: 'bottom' | 'top' | 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight' | 'topCenter' | 'bottomCenter' | 'right'
    autoClose?: boolean
  }>(),
  {
    trigger: () => ['click'],
    visible: undefined,
    placement: 'bottomLeft',
    disabled: false,
    overlayClassName: undefined,
    autoClose: true,
    overlayStyle: () => ({}),
  },
)

const emits = defineEmits(['update:visible'])

const trigger = toRef(props, 'trigger')

const overlayClassName = toRef(props, 'overlayClassName')

const placement = toRef(props, 'placement')

const overlayStyle = toRef(props, 'overlayStyle')

const autoClose = computed(() => props.autoClose)

const visible = useVModel(props, 'visible', emits)

const overlayClassNameComputed = computed(() => {
  let className = 'nc-dropdown bg-white rounded-lg border-1 border-gray-200 shadow-lg'
  if (overlayClassName.value) {
    className += ` ${overlayClassName.value}`
  }
  className += visible.value ? ' active' : ' '
  return className
})

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

const onVisibleUpdate = (event: any) => {
  if (visible !== undefined) {
    visible.value = event
  } else {
    emits('update:visible', event)
  }
}
</script>

<template>
  <a-dropdown
    :disabled="disabled"
    :visible="visible"
    :placement="placement as any"
    :trigger="trigger"
    :overlay-class-name="overlayClassNameComputed"
    :overlay-style="overlayStyle"
    @update:visible="onVisibleUpdate"
  >
    <slot />

    <template #overlay>
      <slot ref="overlayWrapperDomRef" name="overlay" />
    </template>
  </a-dropdown>
</template>
