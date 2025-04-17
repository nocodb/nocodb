<script lang="ts" setup>
const _props = defineProps<{
  expanded?: boolean
}>()

const { isPaidPlan, isWsOwner, navigateToPricing } = useEeConfig()
</script>

<template>
  <div
    v-if="!isPaidPlan"
    class="nc-payment-banner-wrapper px-6 pt-6 max-w-[1300px] mx-auto"
    :class="{
      'nc-payment-banner-expanded': !isMinimised,
    }"
  >
    <div
      class="nc-payment-banner rounded-xl border-1 border-nc-border-gray-medium bg-nc-bg-maroon-light overflow-hidden relative flex gap-6 transition-all duration-300"
      :class="{
        'p-4 min-h-[66px]': !expanded,
        'p-6 min-h-[186px]': expanded,
      }"
    >
      <div
        class="flex"
        :class="{
          'justify-between w-full': !expanded,
          'flex-col': expanded,
        }"
      >
        <div class="text-xl font-weight-700 text-nc-content-gray leading-[32px]">{{ $t('title.getMoreFromNocodb') }}</div>
        <div v-if="expanded" class="mt-2">
          {{ $t('title.getMoreFromNocodbSubtitle') }}
        </div>
        <div
          class="flex gap-2"
          :class="{
            'flex-row-reverse': !expanded,
            'mt-5': expanded,
          }"
        >
          <NcButton
            class="nc-upgrade-plan-btn"
            type="primary"
            size="small"
            data-testid="nc-workspace-settings-upgrade-button"
            icon-position="right"
            inner-class="!gap-2"
            @click.stop="navigateToPricing()"
          >
            <template #icon>
              <GeneralIcon icon="ncArrowUpRight" class="h-4 w-4" />
            </template>
            {{ isWsOwner ? $t('labels.upgradePlan') : $t('general.requestUpgrade') }}
          </NcButton>
          <div class="!no-underline">
            <NcButton
              type="text"
              size="small"
              data-testid="nc-workspace-settings-view-all-plan-btn"
              class="!hover:bg-nc-bg-maroon-dark"
              @click.stop="navigateToPricing()"
            >
              {{ $t('labels.viewAllPlanDetails') }}
            </NcButton>
          </div>
        </div>
      </div>
      <div v-if="expanded" class="w-[60%] flex items-end justify-end relative -my-6 -mr-7">
        <div class="absolute top-6 left-0 border-t-1 border-l-1 rounded-tl-lg overflow-hidden bg-nc-bg-gray-medium min-w-[500px]">
          <img class="!rounded-rl-lg" src="~assets/img/kanban-view.png" alt="Upgrade Your Workspace" />
        </div>
        <div class="absolute -bottom-[28px] overflow-hidden">
          <img
            class="!rounded-rl-lg nc-finance-img"
            src="~assets/img/finance.png"
            alt="Upgrade Your Workspace"
            height="126px"
            width="133px"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-payment-banner {
  box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);

  .nc-finance-img {
    -webkit-transform: scaleX(-1);
    transform: scaleX(-1);
  }

  .nc-upgrade-plan-btn {
    @apply bg-nc-fill-maroon-medium !hover:bg-nc-fill-maroon-dark;
  }
}
</style>
