<script lang="ts" setup>
interface Props {
  label?: string
  icon?: string
  activeIcon?: string
  active?: boolean
  disabled?: boolean
  panelKey?: string
  scale?: number
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  icon: undefined,
  activeIcon: undefined,
  active: false,
  disabled: false,
  panelKey: undefined,
  scale: 1,
})

const emits = defineEmits<{
  (e: 'click'): void
}>()

const currentIcon = computed(() => {
  if (props.active && props.activeIcon) return props.activeIcon
  return props.icon
})

const BASE_SIZE = 48

const dynamicMargin = computed(() => {
  return ((props.scale - 1) * BASE_SIZE) / 2
})

const itemStyle = computed(() => ({
  transform: `scale(${props.scale})`,
  marginTop: `${dynamicMargin.value}px`,
  marginBottom: `${dynamicMargin.value}px`,
}))
</script>

<template>
  <div
    class="nc-dock-item"
    :class="{ active, disabled }"
    :style="itemStyle"
    :data-panel="panelKey"
    :data-label="label || undefined"
    @click="!disabled && emits('click')"
  >
    <!-- Active indicator bar -->
    <span class="nc-dock-item-indicator" />

    <slot>
      <GeneralIcon v-if="currentIcon" :icon="(currentIcon as any)" class="nc-dock-item-icon" />
    </slot>
  </div>
</template>

<style lang="scss" scoped>
.nc-dock-item {
  @apply relative flex items-center justify-center cursor-pointer flex-shrink-0 text-nc-content-gray-muted;
  width: 48px;
  height: 48px;
  border-radius: 10px;
  transform-origin: left center;
  will-change: transform, margin;
  transition: transform 0.16s ease-out, margin 0.16s ease-out;

  // CSS-only tooltip via data-label (matches reference — no wrapper element)
  &[data-label]:hover::before {
    content: attr(data-label);
    position: absolute;
    left: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.88);
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 6px;
    white-space: nowrap;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
    z-index: 60;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .nc-dock-item-indicator {
    @apply bg-nc-content-brand;
    position: absolute;
    left: -12px;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 20px;
    border-radius: 0 3px 3px 0;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
  }

  .nc-dock-item-icon {
    @apply h-5 w-5 flex items-center justify-center;
    color: inherit;
    pointer-events: none;
  }

  &:hover:not(.active):not(.disabled) {
    @apply text-nc-content-subtle2;
    background: rgba(0, 0, 0, 0.05);

    :root[theme='dark'] & {
      background: rgba(255, 255, 255, 0.06);
    }
  }

  &.active {
    @apply text-nc-content-brand;
    background: rgba(0, 0, 0, 0.08);

    :root[theme='dark'] & {
      background: rgba(255, 255, 255, 0.08);
    }

    .nc-dock-item-indicator {
      opacity: 1;
    }
  }

  &.disabled {
    @apply opacity-40 cursor-not-allowed;
  }
}
</style>

<style lang="scss">
.rtl .nc-dock-item {
  transform-origin: right center;

  &[data-label]:hover::before {
    left: auto;
    right: calc(100% + 10px);
  }

  .nc-dock-item-indicator {
    left: auto;
    right: -12px;
    border-radius: 3px 0 0 3px;
  }
}
</style>
