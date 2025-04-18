<script lang="ts" setup>
import bgImage from '~/assets/img/upgrade-bg.png'

const _props = defineProps<{
  expanded?: boolean
}>()

const { isPaidPlan, isWsOwner, navigateToPricing } = useEeConfig()
</script>

<template>
  <div
    v-if="!isPaidPlan"
    class="nc-payment-banner-wrapper"
    :class="{
      'nc-payment-banner-expanded': expanded,
    }"
  >
    <div
      class="nc-payment-banner overflow-hidden relative flex gap-6 transition-all duration-300"
      :class="{
        'p-4 min-h-[66px]': !expanded,
        'p-6 min-h-[186px]': expanded,
      }"
      :style="{
        'background-image': `url(${bgImage})`,
        'background-color': 'rgba(255, 255, 255, 0.7)',
        'background-blend-mode': 'overlay',
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
            class="nc-upgrade-plan-btn !bg-blue-200 !border-0"
            type="secondary"
            size="small"
            data-testid="nc-workspace-settings-upgrade-button"
            inner-class="!gap-2"
            @click.stop="navigateToPricing()"
          >
            <div class="flex items-center gap-1">
              <GeneralIcon icon="ncArrowUpRight" class="h-4 w-4 mt-0.5" />
              <span>{{ isWsOwner ? 'Upgrade' : $t('general.requestUpgrade') }}</span>
            </div>
          </NcButton>
          <div class="!no-underline">
            <NcButton
              type="text"
              size="small"
              data-testid="nc-workspace-settings-view-all-plan-btn"
              @click.stop="navigateToPricing({ autoScroll: 'planDetails', newTab: true })"
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
  .nc-finance-img {
    -webkit-transform: scaleX(-1);
    transform: scaleX(-1);
  }
}
</style>
