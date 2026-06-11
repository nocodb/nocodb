<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  // Bumped by the parent whenever the toolbar width changes (expanded-form / extension /
  // action side panels opening, resizing, or a window resize). The search box is a
  // teleported ant popup anchored to a 0-size trigger in the toolbar; ant only re-positions
  // a popup when the popup/trigger *size* changes or its `align` prop deep-changes — never on
  // a position-only shift of the trigger (its window-resize listener is never attached in this
  // ant version). So we encode the tick into `align` below to force a re-align.
  realignTick?: number
}>()

const { isMobileMode } = useGlobal()

// vc-align re-aligns only when its `align` prop is deep-unequal to the previous one. We toggle
// `targetOffset` by a sub-pixel amount keyed off `realignTick`: visually imperceptible (rounds
// to 0px) but enough to make `align` deep-unequal, which re-aligns the popup to the moved
// trigger. Only `targetOffset` is set so the `bottomRight` placement's points/offset/overflow
// are preserved by the `{ ...placement, ...align }` merge in getAlignFromPlacement.
const popupAlign = computed(() => ({
  targetOffset: [0, (props.realignTick ?? 0) % 2 === 0 ? 0 : 0.01] as [number, number],
}))
</script>

<template>
  <slot v-if="isMobileMode" />
  <NcDropdown
    v-else
    :visible="visible"
    :trigger="['click']"
    placement="bottomRight"
    :align="popupAlign"
    overlay-class-name="nc-dropdown-toolbar-search !border-primary !shadow-selected overflow-hidden !z-1000"
    non-nc-dropdown
  >
    <div class="absolute -right-1 -top-5"></div>
    <template #overlay>
      <slot />
    </template>
  </NcDropdown>
</template>
