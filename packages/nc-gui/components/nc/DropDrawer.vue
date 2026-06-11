<script lang="ts" setup>
import type { NcDropdownPlacement } from '#imports'

interface Props {
  visible?: boolean | undefined
  title?: string

  // Dropdown props (desktop)
  trigger?: Array<'click' | 'hover' | 'contextmenu'>
  overlayClassName?: string
  overlayStyle?: Record<string, any>
  placement?: NcDropdownPlacement
  align?: {
    points?: [string, string]
    offset?: [number, number]
    targetOffset?: [number, number]
    overflow?: { adjustX?: boolean; adjustY?: boolean }
  }
  autoClose?: boolean
  disabled?: boolean
  nonNcDropdown?: boolean
  onVisibleChange?: (val: boolean) => void

  // Drawer props (mobile)
  drawerHeight?: string
  drawerContentHeight?: boolean
  drawerMaxHeight?: string
  drawerPlacement?: 'bottom' | 'top' | 'left' | 'right'
  closable?: boolean
  maskClosable?: boolean
  destroyOnClose?: boolean
  drawerWrapClassName?: string
  drawerBodyStyle?: Record<string, any>
  showDragHandle?: boolean
  swipeToClose?: boolean
  swipeThreshold?: number
  scrollableBody?: boolean
  drawerBodyClassName?: string
}

const props = withDefaults(defineProps<Props>(), {
  visible: undefined,
  title: '',
  trigger: () => ['click'],
  overlayClassName: undefined,
  overlayStyle: () => ({}),
  placement: 'bottomLeft',
  align: undefined,
  autoClose: true,
  disabled: false,
  nonNcDropdown: false,
  onVisibleChange: undefined,
  drawerHeight: '85svh',
  drawerContentHeight: false,
  drawerMaxHeight: '85svh',
  drawerPlacement: 'bottom',
  closable: false,
  maskClosable: true,
  destroyOnClose: true,
  drawerWrapClassName: '',
  drawerBodyStyle: () => ({}),
  showDragHandle: true,
  swipeToClose: true,
  swipeThreshold: 80,
  scrollableBody: true,
  drawerBodyClassName: '',
})

const emits = defineEmits(['update:visible'])

const { isMobileMode } = useGlobal()

const visible = useVModel(props, 'visible', emits)

const dropdownProps = computed(() => ({
  trigger: props.trigger,
  overlayClassName: props.overlayClassName,
  overlayStyle: props.overlayStyle,
  placement: props.placement,
  align: props.align,
  autoClose: props.autoClose,
  disabled: props.disabled,
  nonNcDropdown: props.nonNcDropdown,
  onVisibleChange: props.onVisibleChange,
}))

const drawerProps = computed(() => ({
  title: props.title,
  height: props.drawerHeight,
  contentHeight: props.drawerContentHeight,
  maxHeight: props.drawerMaxHeight,
  placement: props.drawerPlacement,
  closable: props.closable,
  maskClosable: props.maskClosable,
  destroyOnClose: props.destroyOnClose,
  wrapClassName: props.drawerWrapClassName,
  bodyStyle: props.drawerBodyStyle,
  showDragHandle: props.showDragHandle,
  swipeToClose: props.swipeToClose,
  swipeThreshold: props.swipeThreshold,
  scrollableBody: props.scrollableBody,
  bodyClassName: props.drawerBodyClassName,
}))
</script>

<template>
  <!-- Mobile: Bottom drawer -->
  <template v-if="isMobileMode">
    <slot :visible="visible" :on-change="(v: boolean) => (visible = v)" :on-click="() => (visible = !visible)" />

    <NcDrawer v-model:visible="visible" v-bind="drawerProps">
      <template v-if="$slots['drawer-header']" #header>
        <slot name="drawer-header" />
      </template>

      <slot name="overlay" :visible="visible" :on-change="(v: boolean) => (visible = v)" />

      <template v-if="$slots['drawer-footer']" #footer>
        <slot name="drawer-footer" />
      </template>
    </NcDrawer>
  </template>

  <!-- Desktop: Dropdown -->
  <NcDropdown v-else v-model:visible="visible" v-bind="dropdownProps">
    <slot :visible="visible" :on-change="(v: boolean) => (visible = v)" :on-click="() => undefined" />

    <template #overlay>
      <slot name="overlay" :visible="visible" :on-change="(v: boolean) => (visible = v)" />
    </template>
  </NcDropdown>
</template>
