<script setup lang="ts">
import 'driver.js/dist/driver.css'

const { init, refresh, isActive, activeBeacons, popoverFooter, popoverNav, goNext, goPrev, closeTour } = useTours()

onMounted(init)

useEventListener(window, 'resize', () => {
  if (isActive.value) refresh()
})
</script>

<template>
  <TourBeacon v-for="beacon of activeBeacons" :key="beacon.tour.id" :tour="beacon.tour" :anchor="beacon.anchor" />
  <Teleport v-if="popoverFooter" :to="popoverFooter">
    <div class="flex items-center gap-2">
      <!-- The only way out: `allowClose: false` suppresses driver's ✕ and `allowKeyboardControl: false` suppresses Esc -->
      <NcButton
        v-if="!popoverNav.isLast"
        v-e="['c:tour:skip']"
        size="small"
        type="text"
        data-testid="nc-tour-skip"
        @click="closeTour"
      >
        {{ $t('general.skip') }}
      </NcButton>
      <NcButton v-if="popoverNav.hasPrev" size="small" type="secondary" data-testid="nc-tour-prev" @click="goPrev">
        {{ $t('general.back') }}
      </NcButton>
      <NcTooltip
        v-if="!popoverNav.advanceOnClick || popoverNav.isLast"
        :disabled="popoverNav.canAdvance"
        :title="$t('tooltip.tourCompleteStepToContinue')"
      >
        <NcButton size="small" type="primary" data-testid="nc-tour-next" :disabled="!popoverNav.canAdvance" @click="goNext">
          {{ popoverNav.isLast ? $t('general.done') : $t('general.next') }}
        </NcButton>
      </NcTooltip>
    </div>
  </Teleport>
</template>

<style lang="scss">
/**
 * driver.js locks the page (`.driver-active * { pointer-events: none }`), which
 * kills every dropdown and dialog portalled to <body>. Our tours ask people to
 * actually use the UI, so unlock it.
 */
.driver-active *:not(.driver-overlay) {
  pointer-events: auto;
}

/**
 * driver.js sets `pointer-events: auto` *inline* on the overlay path so it can
 * catch backdrop clicks. We use `allowClose: false`, so it only steals clicks
 * from whatever is underneath. `!important` — inline outranks a normal rule.
 */
.driver-active .driver-overlay,
.driver-active .driver-overlay * {
  pointer-events: none !important;
}

/**
 * driver hides the footer inline (hence `!important`) when it renders no button or
 * progress text of its own — which is every single-step tour. Our controls are
 * teleported into it, so it has to stay visible.
 */
.driver-popover.nc-tour-popover .driver-popover-footer {
  display: flex !important;
}

.driver-popover.nc-tour-popover {
  @apply bg-nc-bg-default rounded-lg shadow-lg;

  border: 1px solid var(--nc-border-gray-medium);
  max-width: 320px;
  padding: 16px;

  .driver-popover-title {
    @apply text-nc-content-gray text-subHeading2;

    margin-bottom: 4px;
  }

  .driver-popover-description {
    @apply text-nc-content-gray-subtle text-bodySm;

    margin-bottom: 12px;
  }

  .driver-popover-progress-text {
    @apply text-nc-content-gray-muted text-captionSm;
  }

  .driver-popover-close-btn {
    @apply text-nc-content-gray-muted;

    &:hover {
      @apply text-nc-content-gray;
    }
  }

  // The arrow is a CSS triangle: recolour only the visible side, or it becomes a square.
  .driver-popover-arrow-side-left {
    border-left-color: var(--nc-bg-default);
  }

  .driver-popover-arrow-side-right {
    border-right-color: var(--nc-bg-default);
  }

  .driver-popover-arrow-side-top {
    border-top-color: var(--nc-bg-default);
  }

  .driver-popover-arrow-side-bottom {
    border-bottom-color: var(--nc-bg-default);
  }
}
</style>
