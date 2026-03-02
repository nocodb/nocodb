<script lang="ts" setup>
/**
 * DashboardMiniSidebarItem — reusable mini sidebar item with label + tooltip.
 *
 * Two variants:
 *   - "btn" (default): Simple clickable item with icon + label. Supports active state.
 *   - "item": Wraps interactive components (e.g. NotificationMenu, Theme).
 *             Suppresses inner hover states — outer container handles hover.
 *
 * When the label is hidden on smaller screens (<= 1440px), a tooltip is shown on hover.
 *
 * Slots:
 *   - icon    — custom icon content (overrides `icon`/`activeIcon` props)
 *   - default — main content (for "item" variant, e.g. wrapping NotificationMenu)
 *   - label   — custom label content (overrides `label` prop)
 */

interface Props {
  label?: string
  tooltip?: string
  icon?: string
  activeIcon?: string
  active?: boolean
  disabled?: boolean
  variant?: 'btn' | 'item'
  dataTestid?: string
  hideOnClickDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  tooltip: '',
  icon: undefined,
  activeIcon: undefined,
  active: false,
  disabled: false,
  variant: 'btn',
  dataTestid: undefined,
  hideOnClickDisabled: false,
})

const emits = defineEmits<{
  (e: 'click'): void
}>()

const { width } = useWindowSize()

const isLabelHidden = computed(() => width.value <= 1440)

const tooltipText = computed(() => props.tooltip || props.label)

const currentIcon = computed(() => {
  if (props.active && props.activeIcon) return props.activeIcon
  return props.icon
})
</script>

<template>
  <NcTooltip
    class="w-full"
    placement="right"
    :arrow="false"
    :disabled="(!isLabelHidden && !!label) || !tooltipText"
    :hide-on-click="!hideOnClickDisabled"
  >
    <template #title>{{ tooltipText }}</template>

    <div
      :class="[variant === 'btn' ? 'nc-mini-sidebar-labeled-btn' : 'nc-mini-sidebar-labeled-item', { active, disabled }]"
      :data-testid="dataTestid"
      @click="!disabled && emits('click')"
    >
      <slot v-if="$slots.default" />

      <template v-else>
        <slot name="icon">
          <GeneralIcon v-if="currentIcon" :icon="currentIcon" class="h-4.5 w-4.5" />
        </slot>
      </template>

      <span v-if="label || $slots.label" class="nc-mini-sidebar-label">
        <slot name="label">{{ label }}</slot>
      </span>
    </div>
  </NcTooltip>
</template>
