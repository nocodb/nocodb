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
    align?: {
      points?: [string, string]
      offset?: [number, number]
      targetOffset?: [number, number]
      overflow?: { adjustX?: boolean; adjustY?: boolean }
    }
    autoClose?: boolean
    // if true, the dropdown will not have the nc-dropdown class (used for blocking keyboard events)
    nonNcDropdown?: boolean
    // if true, renders a transparent backdrop behind the dropdown that stops click propagation.
    // Use when this dropdown is nested inside another dropdown to prevent the parent from closing.
    useBackdrop?: boolean
    onVisibleChange?: (val: boolean) => void
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
    useBackdrop: false,
  },
)

const emits = defineEmits(['update:visible'])

defineOptions({ inheritAttrs: false })

// Global z-index counter for backdrop dropdowns — each nested level gets a higher z-index
const backdropBaseZIndex = 1050
const activeBackdropCount = ref(0)

const trigger = toRef(props, 'trigger')

const overlayClassName = toRef(props, 'overlayClassName')

const placement = toRef(props, 'placement')

const overlayStyle = toRef(props, 'overlayStyle')

const autoClose = computed(() => props.autoClose)

const visible = useVModel(props, 'visible', emits)

const localIsVisible = ref<boolean | undefined>(props.visible)

const overlayClassNameComputed = computed(() => {
  let className = `${props.nonNcDropdown ? '' : 'nc-dropdown '} rounded-lg border-1 border-nc-border-gray-medium shadow-lg`
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
  props.onVisibleChange?.(isVisible)

  if (!ncIsUndefined(props.visible)) return

  localIsVisible.value = isVisible
}

const onBackdropMouseDown = () => {
  visible.value = false
}

// Track this dropdown's z-index level for backdrop stacking
const backdropLevel = ref(0)

const backdropZIndex = computed(() => backdropBaseZIndex + backdropLevel.value * 2)

const overlayZIndex = computed(() => backdropBaseZIndex + backdropLevel.value * 2 + 1)

const overlayStyleComputed = computed(() => {
  if (!props.useBackdrop) return overlayStyle.value

  return {
    ...overlayStyle.value,
    zIndex: overlayZIndex.value,
  }
})

watch(
  visible,
  (newValue, oldValue) => {
    if (props.useBackdrop) {
      if (newValue && !oldValue) {
        backdropLevel.value = activeBackdropCount.value
        activeBackdropCount.value++
      } else if (!newValue && oldValue) {
        activeBackdropCount.value = Math.max(0, activeBackdropCount.value - 1)
      }
    }

    if (newValue === localIsVisible.value) return

    localIsVisible.value = visible.value
  },
  { immediate: true },
)
</script>

<template>
  <a-dropdown
    v-bind="$attrs"
    :disabled="disabled"
    :visible="visible"
    :placement="placement as any"
    :trigger="trigger"
    :overlay-class-name="overlayClassNameComputed"
    :overlay-style="overlayStyleComputed"
    :align="align"
    @update:visible="onVisibleUpdate"
    @visible-change="onVisibilityChange"
  >
    <slot :visible="localIsVisible" :on-change="onVisibleUpdate" />

    <template #overlay>
      <slot ref="overlayWrapperDomRef" name="overlay" :visible="localIsVisible" :on-change="onVisibleUpdate" />
    </template>
  </a-dropdown>

  <Teleport to="body">
    <div
      v-if="useBackdrop && visible"
      class="fixed inset-0"
      :style="{ zIndex: backdropZIndex }"
      @mousedown.stop="onBackdropMouseDown"
    />
  </Teleport>
</template>
