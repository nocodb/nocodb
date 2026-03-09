<script lang="ts" setup>
import type { NcDropdownPlacement } from '#imports'
/**
 * NcDropDrawer — responsive dropdown that renders as NcDropdown on desktop
 * and NcDrawer (bottom sheet) on mobile.
 *
 * Drop-in replacement for NcDropdown. Change the tag, get mobile support.
 *
 * ## Ant Design Vue Combo Style Issue
 *
 * When `a-menu` (NcMenu) is the root child inside `a-dropdown`'s overlay slot,
 * Ant Design Vue injects context that makes it render with `ant-dropdown-menu`
 * prefix classes instead of `ant-menu`. All NcMenu/NcMenuItem styles target
 * `.ant-dropdown-menu-item`, not `.ant-menu-item`.
 *
 * In the drawer, that dropdown context is lost. The `.nc-drop-drawer-body`
 * wrapper re-maps `ant-menu-*` classes to match `ant-dropdown-menu-*` via CSS.
 */
interface Props {
  // NcDropdown props
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
  nonNcDropdown?: boolean
  onVisibleChange?: (val: boolean) => void
  // Drawer-specific props
  drawerTitle?: string
  drawerPlacement?: 'bottom' | 'right'
  drawerHeight?: string
  drawerBodyClassName?: string
  showDragHandle?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  trigger: () => ['click'],
  visible: undefined,
  placement: 'bottomLeft',
  disabled: false,
  overlayClassName: undefined,
  autoClose: true,
  overlayStyle: () => ({}),
  nonNcDropdown: false,
  drawerTitle: undefined,
  drawerPlacement: 'bottom',
  drawerHeight: 'auto',
  drawerBodyClassName: '',
  showDragHandle: true,
})
const emits = defineEmits<{
  'update:visible': [value: boolean | undefined]
}>()
const { isMobileMode } = useGlobal()
const visible = useVModel(props, 'visible', emits)
// Mobile: local visible when parent doesn't control v-model
const localDrawerVisible = ref(false)
const drawerVisible = computed({
  get: () => visible.value ?? localDrawerVisible.value,
  set: (val: boolean) => {
    if (visible.value !== undefined) {
      visible.value = val
    } else {
      localDrawerVisible.value = val
      emits('update:visible', val)
    }
    // Fire the callback regardless of controlled/uncontrolled mode
    props.onVisibleChange?.(val)
  },
})
const onTriggerClick = () => {
  if (props.disabled) return
  drawerVisible.value = !drawerVisible.value
}
</script>
<template>
  <template v-if="isMobileMode">
    <!--
      Mobile trigger — `display: contents` wrapper is invisible to layout
      (no extra box) but captures clicks to toggle the drawer.
    -->
    <div class="nc-drop-drawer-trigger" @click="onTriggerClick">
      <slot :visible="drawerVisible" :on-change="(val: boolean) => (drawerVisible = val)" />
    </div>
    <!-- Mobile drawer -->
    <NcDrawer
      v-model:visible="drawerVisible"
      :title="drawerTitle"
      :placement="drawerPlacement"
      :height="drawerHeight"
      :mask-closable="autoClose"
      :show-drag-handle="showDragHandle"
      :body-class-name="drawerBodyClassName"
      panel-body-class="nc-drop-drawer-body"
    >
      <template v-if="$slots.header" #header>
        <slot name="header" />
      </template>
      <!--
        .nc-drop-drawer-body re-maps ant-menu-* → ant-dropdown-menu-* styles.
        overlayClassName is forwarded so consumers can style the drawer body
        the same way they style the dropdown overlay.
      -->
      <div class="nc-drop-drawer-body" :class="overlayClassName">
        <slot name="overlay" :visible="drawerVisible" :on-change="(val: boolean) => (drawerVisible = val)" />
      </div>
    </NcDrawer>
  </template>
  <!-- Desktop: standard NcDropdown -->
  <NcDropdown
    v-else
    v-model:visible="visible"
    :trigger="trigger"
    :overlay-class-name="overlayClassName"
    :overlay-style="overlayStyle"
    :disabled="disabled"
    :placement="placement"
    :align="align"
    :auto-close="autoClose"
    :non-nc-dropdown="nonNcDropdown"
    :on-visible-change="onVisibleChange"
  >
    <slot :visible="visible" :on-change="(val: boolean) => (visible = val)" />
    <template #overlay="overlayProps">
      <slot name="overlay" v-bind="overlayProps" />
    </template>
  </NcDropdown>
</template>
<style lang="scss" scoped>
.nc-drop-drawer-trigger {
  display: contents;
}
</style>
<style lang="scss">
/**
 * Re-map ant-menu classes to match ant-dropdown-menu styles.
 *
 * When NcMenu (a-menu) renders outside of a-dropdown, it uses ant-menu-* classes.
 * But all NcMenu/NcMenuItem/theme-override styles target ant-dropdown-menu-*.
 * This wrapper bridges that gap so menus look identical in the drawer.
 */
.nc-drop-drawer-body {
  // Menu root
  .ant-menu.nc-menu {
    @apply !rounded-none !shadow-none !border-none !py-2 !px-3;
  }
  // Menu items — mobile-optimized sizing
  .ant-menu-item.nc-menu-item {
    @apply p-0 mx-0 font-normal text-sm rounded-none overflow-hidden;
    // Larger touch targets on mobile
    @apply text-base py-3 px-3.5;
    .nc-menu-item-inner {
      @apply flex flex-row items-center gap-x-2 text-sm;
    }
    > .ant-menu-title-content {
      :not(.nc-icon):not(.material-symbols) {
        line-height: 20px;
      }
      @apply flex flex-row items-center;
    }
    &::after {
      background: none;
    }
    &:not(.ant-menu-item-disabled) {
      @apply text-nc-content-gray-subtle;
    }
    &.ant-menu-item-disabled {
      @apply !text-nc-content-gray-disabled;
    }
  }
  // Danger items
  .ant-menu-item.nc-menu-item.nc-menu-item-danger {
    &:not(.ant-menu-item-disabled) {
      @apply !text-nc-content-red-medium;
    }
  }
  // AI theme items
  .ant-menu-item.nc-menu-item.nc-menu-item-ai {
    &:not(.ant-menu-item-disabled) {
      @apply !text-nc-content-purple-medium;
    }
  }
  // General menu item reset
  .ant-menu-item {
    @apply py-0;
  }
  .ant-menu-title-content {
    @apply !py-0;
  }
  // Background for root menu
  .ant-menu {
    @apply !bg-transparent !text-nc-content-gray;
  }
  // NcMenu label items
  .nc-ant-dropdown-menu-item-label {
    @apply py-2.5 text-bodyDefaultSmBold;
  }
  // ─── Notion-style grouped cards ────────────────────────────────────
  // Items between NcDividers share a rounded background card.
  // NcMenuItem wraps a-menu-item in div.w-full, so we target those
  // as direct children of the menu root.
  .ant-menu.nc-menu {
    @apply gap-0;
    // Item wrappers get the group card background
    > div.w-full {
      @apply mx-0;
      background: var(--nc-bg-gray-light);
      // Internal separator between items in the same group
      & + div.w-full {
        border-top: 1px solid var(--nc-border-gray-light);
      }
    }
    // ── Group start: first child or immediately after a divider
    > div.w-full:first-child,
    > .nc-divider + div.w-full {
      border-top-left-radius: 10px;
      border-top-right-radius: 10px;
      border-top: none; // no separator at group start
    }
    // ── Group end: last child or immediately before a divider (:has)
    > div.w-full:last-child,
    > div.w-full:has(+ .nc-divider) {
      border-bottom-left-radius: 10px;
      border-bottom-right-radius: 10px;
    }
    // ── Solo item (only item in its group)
    > .nc-divider + div.w-full:has(+ .nc-divider),
    > div.w-full:first-child:has(+ .nc-divider),
    > div.w-full:only-child {
      @apply rounded-[10px];
      border-top: none;
    }
    // ── Dividers become invisible spacing between groups
    > .nc-divider.ant-divider {
      @apply border-none bg-transparent !my-1.5;
      height: 0;
      min-height: 0;
    }
  }
}
</style>
