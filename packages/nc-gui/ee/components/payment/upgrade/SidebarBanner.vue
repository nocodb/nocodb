<script lang="ts" setup>
import bannerLight from '~/assets/img/upgrade-sidebar-banner-light.png'
import bannerDark from '~/assets/img/upgrade-sidebar-banner-dark.png'
import { PlanTitles } from 'nocodb-sdk'

const {
  isRecordLimitReached,
  isStorageLimitReached,
  gracePeriodDaysLeft,
  navigateToBilling,
  activePlanTitle,
  isLoyaltyWorkspace,
  gracePeriodEndDate,
} = useEeConfig()

const isLimitReached = computed(() => {
  return isRecordLimitReached.value || isStorageLimitReached.value
})

const showBanner = computed(() => {
  return isLimitReached.value || activePlanTitle.value === PlanTitles.FREE
})

const showTimer = computed(() => {
  if (isLimitReached.value) {
    return gracePeriodDaysLeft.value > 0
  }

  if (isLoyaltyWorkspace.value) return true

  return false
})

const timerDate = computed(() => {
  return isLimitReached.value ? gracePeriodEndDate.value : '2025-04-30'
})
</script>

<template>
  <div
    v-if="showBanner"
    class="-mx-1 pt-1.5 border-b border-nc-border-gray-medium pointer-events-none"
    :class="{
      'px-2 pb-2': isLimitReached,
      'px-1 pb-1': !isLimitReached,
    }"
  >
    <div
      class="nc-upgrade-sidebar-banner-wrapper w-full !h-auto"
      :class="{
        'nc-limit-reached-banner': isLimitReached,
      }"
      :style="
        isLimitReached
          ? {}
          : {
              'background-image': `url(${bannerDark})`,
              'background-color': 'rgba(255, 255, 255, 0.7)',
              'background-blend-mode': 'overlay',
            }
      "
    >
      <div
        class="nc-upgrade-sidebar-banner w-full !h-auto"
        :style="
          isLimitReached
            ? {}
            : {
                background: `
            url(${bannerLight}) center/cover no-repeat padding-box,
            linear-gradient(to bottom left, #ec7db1, #85a3ff) border-box
          `,
                backgroundClip: 'padding-box, border-box',
                backgroundOrigin: 'padding-box, border-box',
              }
        "
        @click="navigateToBilling()"
      >
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <div class="flex gap-2">
              <GeneralIcon
                v-if="!isLoyaltyWorkspace"
                :icon="isLimitReached ? 'alertTriangleSolid' : 'ncArrowUpCircleSolid'"
                class="h-5 w-5 flex-none mt-0.5"
                :class="{
                  'text-nc-content-orange-medium': isLimitReached,
                  'text-nc-content-brand': !isLimitReached,
                }"
              />
              <div class="text-base font-700 text-nc-content-gray">
                {{
                  isLimitReached
                    ? $t('upgrade.planLimitReached')
                    : isLoyaltyWorkspace
                    ? 'Preview Ending Soon 🎊'
                    : 'Upgrade to Team'
                }}
              </div>
            </div>
            <div class="text-nc-content-gray-subtle2 text-small leading-[18px]">
              {{
                isLimitReached
                  ? `You have exceeded the ${
                      !isRecordLimitReached ? 'records' : 'storage'
                    } limit allowed in the Free plan. Upgrade to increase your limit`
                  : isLoyaltyWorkspace
                  ? 'Thank you for being an early adopter!Upgrade now with discount to continue.'
                  : 'Unlock more seats, extra records, more storage, conditional webhooks, integrations, NocoAI, and more!'
              }}
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <div v-if="true || (showTimer && timerDate)" class="flex items-center justify-center">
              <PaymentExpiresIn
                :end-time="timerDate"
                hide-icon
                hide-label
                class="!bg-transparent text-nc-content-gray-muted text-center"
              />
            </div>

            <NcButton size="small" class="w-full"> Upgrade Now </NcButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-upgrade-sidebar-banner-wrapper {
  @apply w-full rounded-2xl border-1;

  .nc-upgrade-sidebar-banner {
    @apply relative p-4 cursor-pointer pointer-events-auto rounded-xl border-1;
  }

  &.nc-limit-reached-banner {
    @apply border-0;

    .nc-upgrade-sidebar-banner {
      @apply border-nc-border-gray-medium overflow-hidden;

      box-shadow: 0px -2px 12px 0px rgba(0, 0, 0, 0.08) !important;
    }
  }
  &:not(.nc-limit-reached-banner) {
    @apply p-1 border-transparent;

    .nc-upgrade-sidebar-banner {
      @apply border-transparent;
    }
  }
}

.nc-alert-icon {
  :deep(path + path) {
    @apply !stroke-nc-content-brand;
  }
}
</style>
