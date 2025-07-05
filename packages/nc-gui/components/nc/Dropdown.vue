<script lang="ts" setup>
import type { NcDropdownPlacement } from '#imports'

const props = withDefaults(
  defineProps<{
    trigger?: Array<'click' | 'hover' | 'contextmenu'>
    visible?: boolean | undefined
    overlayClassName?: string | undefined
    overlayStyle?: Record<string, any>
    disabled?: boolean
    placement?: NcDropdownPlacement
    autoClose?: boolean
    // if true, the dropdown will not have the nc-dropdown class (used for blocking keyboard events)
    nonNcDropdown?: boolean
  }>(),
  {
    trigger: () => ['click'],
    visible: undefined,
    placement: 'bottomLeft',
    disabled: false,
    overlayClassName: undefined,
    autoClose: true,
    overlayStyle: () => ({}),
    nonNcDropdown: false,
  },
)

const emits = defineEmits(['update:visible'])

const trigger = toRef(props, 'trigger')

const overlayClassName = toRef(props, 'overlayClassName')

const placement = toRef(props, 'placement')

const overlayStyle = toRef(props, 'overlayStyle')

const autoClose = computed(() => props.autoClose)

const visible = useVModel(props, 'visible', emits)

const localIsVisible = ref<boolean | undefined>(props.visible)

const overlayClassNameComputed = computed(() => {
  let className = `${props.nonNcDropdown ? '' : 'nc-dropdown '}bg-white rounded-lg border-1 border-gray-200 shadow-lg`
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

const onVisibleUpdate = (event: boolean) => {
  localIsVisible.value = event

  if (visible.value !== undefined) {
    visible.value = event
  } else {
    emits('update:visible', event)
  }
}

/**
 * If we have not passed a visible prop, then `@update:visible` will not be called.
 * So we need to use this method to update the local state of the dropdown.
 * @param isVisible - the new visibility state of the dropdown
 */
const onVisibilityChange = (isVisible: boolean) => {
  if (!ncIsUndefined(props.visible)) return

  localIsVisible.value = isVisible
}

watch(
  visible,
  (newValue) => {
    if (newValue === localIsVisible.value) return

    localIsVisible.value = visible.value
  },
  { immediate: true },
)
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
    @visible-change="onVisibilityChange"
  >
    <slot :visible="localIsVisible" :on-change="onVisibleUpdate" />

    <template #overlay>
      <slot ref="overlayWrapperDomRef" name="overlay" :visible="localIsVisible" :on-change="onVisibleUpdate" />
    </template>
  </a-dropdown>
</template>
