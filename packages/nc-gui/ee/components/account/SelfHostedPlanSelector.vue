<script lang="ts" setup>
import { OnPremPlanMeta, OnPremPlanOrder, OnPremPlanTitles } from 'nocodb-sdk'

const emit = defineEmits<{
  (e: 'select', planId: string, priceId: string, quantity: number): void
}>()

const { t } = useI18n()

const { plans, paymentMode, loadPlans, getPlanPrice, getPlanPriceAmount } = useOnPremLicense()

const isLoadingPlans = ref(false)

const MAX_SELF_SERVE_SEATS = 100

const seatCount = ref(1)

const SEAT_PRESETS = [10, 25, 50, 100]

const isContactSales = computed(() => seatCount.value > MAX_SELF_SERVE_SEATS)

const sortedPlans = computed(() =>
  [...plans.value].sort(
    (a, b) => (OnPremPlanOrder[a.title as OnPremPlanTitles] ?? 0) - (OnPremPlanOrder[b.title as OnPremPlanTitles] ?? 0),
  ),
)

const planMeta = (title: OnPremPlanTitles) => OnPremPlanMeta[title] || null

const enterpriseMeta = OnPremPlanMeta[OnPremPlanTitles.SELF_HOSTED_ENTERPRISE]

const enterpriseDescriptions = computed(() => [
  t('labels.enterpriseDescEverythingInScale'),
  t('labels.enterpriseDescScimRls'),
  t('labels.enterpriseDescAirgapped'),
  t('labels.enterpriseDescUnlimitedWorkspaces'),
  t('labels.enterpriseDescPrioritySupport'),
])

const selectPlan = (plan: (typeof plans.value)[0]) => {
  const price = getPlanPrice(plan, paymentMode.value)
  if (!price) {
    message.error(t('msg.error.priceNotFound'))
    return
  }
  emit('select', plan.id, price.id, seatCount.value)
}

const onSliderInput = (e: Event) => {
  seatCount.value = Number((e.target as HTMLInputElement).value)
}

const onSeatInputBlur = () => {
  if (!seatCount.value || seatCount.value < 1) {
    seatCount.value = 1
  } else {
    seatCount.value = Math.floor(seatCount.value)
  }
}

const sliderProgress = computed(() => {
  const clamped = Math.min(seatCount.value, MAX_SELF_SERVE_SEATS)
  return ((clamped - 1) / (MAX_SELF_SERVE_SEATS - 1)) * 100
})

const presetPct = (value: number) => ((value - 1) / (MAX_SELF_SERVE_SEATS - 1)) * 100

onMounted(async () => {
  if (plans.value.length === 0) {
    isLoadingPlans.value = true
    await loadPlans()
    isLoadingPlans.value = false
  }
})
</script>

<template>
  <div class="flex flex-col">
    <!-- Billing period toggle -->
    <div class="flex items-center justify-center mb-6">
      <PaymentPlansSelectMode v-model:value="paymentMode" :discount="20" />
    </div>

    <div v-if="isLoadingPlans" class="flex items-center justify-center py-10">
      <GeneralLoader size="xlarge" />
    </div>

    <template v-else>
      <!-- Seat selector -->
      <div class="nc-seat-selector-panel" data-testid="nc-self-hosted-seat-selector">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-nc-content-gray-emphasis">
            {{ $t('labels.seatCount') }}
          </span>

          <div class="nc-seat-input-wrapper">
            <input v-model.number="seatCount" type="number" min="1" class="nc-seat-input" @blur="onSeatInputBlur" />
          </div>
        </div>

        <!-- Slider track -->
        <input
          type="range"
          :value="Math.min(seatCount, MAX_SELF_SERVE_SEATS)"
          min="1"
          :max="MAX_SELF_SERVE_SEATS"
          step="1"
          class="nc-seat-slider"
          :style="{ '--progress': `${sliderProgress}%` }"
          @input="onSliderInput"
        />

        <!-- Preset chips positioned at slider values -->
        <div class="nc-preset-track">
          <button
            v-for="preset in SEAT_PRESETS"
            :key="preset"
            class="nc-seat-preset"
            :class="{ active: seatCount === preset }"
            :style="{ left: `calc(9px + (100% - 18px) * ${presetPct(preset) / 100})` }"
            @click="seatCount = preset"
          >
            <span class="nc-seat-preset-caret" />
            {{ preset }}
          </button>
        </div>
      </div>

      <!-- Plan cards -->
      <div class="grid grid-cols-3 gap-4 mt-6">
        <!-- Self-serve plans (Starter, Scale) -->
        <div
          v-for="plan in sortedPlans"
          :key="plan.id"
          class="nc-plan-card"
          :style="{
            '--plan-border': planMeta(plan.title as OnPremPlanTitles)?.border || 'var(--nc-border-gray-medium)',
            '--plan-bg': planMeta(plan.title as OnPremPlanTitles)?.bgLight || 'var(--nc-bg-default)',
            '--plan-bg-dark': planMeta(plan.title as OnPremPlanTitles)?.bgDark || 'var(--nc-bg-gray-light)',
            '--plan-badge-bg': planMeta(plan.title as OnPremPlanTitles)?.badgeBgColor,
            '--plan-badge-text': planMeta(plan.title as OnPremPlanTitles)?.badgeTextColor,
          }"
          :data-testid="`nc-self-hosted-plan-${plan.title}`"
        >
          <!-- Badge -->
          <div
            class="inline-flex px-2 py-0.75 rounded-[6px] text-sm font-bold w-fit"
            :style="{ backgroundColor: 'var(--plan-badge-bg)', color: 'var(--plan-badge-text)' }"
          >
            {{ $t(`objects.paymentPlan.${plan.title}`) }}
          </div>

          <!-- Price -->
          <div class="mt-4">
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-bold text-nc-content-gray-emphasis">${{ getPlanPriceAmount(plan) }}</span>
              <span class="text-sm text-nc-content-gray-muted"> / {{ $t('labels.userPerMonth') }}</span>
            </div>

            <div v-if="paymentMode === 'year'" class="text-xs text-nc-content-gray-muted mt-0.5">
              {{ $t('labels.billedAnnually') }}
            </div>
            <div v-else class="h-4" />
          </div>

          <!-- Total summary -->
          <div class="nc-plan-total-row">
            <span class="text-sm text-nc-content-gray-subtle">
              {{ seatCount }} {{ seatCount === 1 ? $t('general.seat') : $t('general.seats') }}
            </span>
            <span class="text-sm font-bold text-nc-content-gray-emphasis">
              ${{ getPlanPriceAmount(plan) * seatCount }}
              <span class="text-xs font-normal text-nc-content-gray-muted">{{ $t('labels.perMonth') }}</span>
            </span>
          </div>

          <!-- Features -->
          <div v-if="plan.descriptions?.length" class="flex flex-col gap-2.5 mt-4">
            <div v-for="(desc, idx) in plan.descriptions" :key="idx" class="flex items-start gap-2 text-sm text-nc-content-gray">
              <GeneralIcon icon="circleCheckSolid" class="flex-none w-4 h-4 mt-0.5 text-nc-content-green-dark" />
              {{ desc }}
            </div>
          </div>

          <!-- CTA -->
          <div class="mt-auto pt-5">
            <NcButton
              v-if="!isContactSales"
              :type="plan.title === OnPremPlanTitles.SELF_HOSTED_SCALE ? 'primary' : 'secondary'"
              size="medium"
              class="!w-full"
              @click.stop="selectPlan(plan)"
            >
              {{ $t('labels.selectPlanName', { plan: $t(`objects.paymentPlan.${plan.title}`) }) }}
            </NcButton>
            <NcButton
              v-else
              type="secondary"
              size="medium"
              class="!w-full"
              @click="navigateTo('https://cal.com/nocodb/sales', { external: true, open: { target: '_blank' } })"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon icon="ncMail" class="h-4 w-4" />
                {{ $t('labels.contactSales') }}
              </div>
            </NcButton>
          </div>
        </div>

        <!-- Enterprise — Contact Sales (not self-serve) -->
        <div
          class="nc-plan-card"
          :style="{
            '--plan-border': enterpriseMeta.border,
            '--plan-bg': enterpriseMeta.bgLight,
            '--plan-bg-dark': enterpriseMeta.bgDark,
            '--plan-badge-bg': enterpriseMeta.badgeBgColor,
            '--plan-badge-text': enterpriseMeta.badgeTextColor,
          }"
          data-testid="nc-self-hosted-plan-enterprise"
        >
          <!-- Badge -->
          <div
            class="inline-flex px-2 py-0.75 rounded-[6px] text-sm font-bold w-fit"
            :style="{ backgroundColor: 'var(--plan-badge-bg)', color: 'var(--plan-badge-text)' }"
          >
            {{ $t('objects.paymentPlan.Self-hosted Enterprise') }}
          </div>

          <!-- Custom pricing -->
          <div class="mt-4">
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-bold text-nc-content-gray-emphasis">{{ $t('labels.customPricing') }}</span>
            </div>
            <div class="h-4" />
          </div>

          <!-- Spacer to align with total row -->
          <div class="nc-plan-total-row">
            <span class="text-sm text-nc-content-gray-subtle">{{ $t('labels.tailoredForYourOrg') }}</span>
          </div>

          <!-- Features -->
          <div class="flex flex-col gap-2.5 mt-4">
            <div v-for="desc in enterpriseDescriptions" :key="desc" class="flex items-start gap-2 text-sm text-nc-content-gray">
              <GeneralIcon icon="circleCheckSolid" class="flex-none w-4 h-4 mt-0.5 text-nc-content-green-dark" />
              {{ desc }}
            </div>
          </div>

          <!-- CTA -->
          <div class="mt-auto pt-5">
            <NcButton
              type="secondary"
              size="medium"
              class="!w-full"
              @click="navigateTo('https://cal.com/nocodb/sales', { external: true, open: { target: '_blank' } })"
            >
              <div class="flex items-center gap-1.5">
                <GeneralIcon icon="ncMail" class="h-4 w-4" />
                {{ $t('labels.contactSales') }}
              </div>
            </NcButton>
          </div>
        </div>
      </div>
    </template>

    <!-- Help & FAQ -->
    <NcDivider class="!my-8" />

    <div class="grid grid-cols-2 gap-6">
      <div class="flex flex-col gap-3">
        <div class="text-sm font-semibold text-nc-content-gray-emphasis">
          {{ $t('title.helpAndSupport') }}
        </div>
        <div class="text-sm text-nc-content-gray-subtle">
          {{ $t('title.helpAndSupportSubtitle') }}
        </div>
        <div>
          <NcButton
            type="secondary"
            size="small"
            @click="navigateTo('https://cal.com/nocodb/sales', { external: true, open: { target: '_blank' } })"
          >
            <div class="flex items-center gap-1.5">
              <GeneralIcon icon="ncMail" class="h-4 w-4" />
              {{ $t('labels.contactSales') }}
            </div>
          </NcButton>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <div class="text-sm font-semibold text-nc-content-gray-emphasis">
          {{ $t('title.faq') }}
        </div>
        <div class="text-sm text-nc-content-gray-subtle">
          {{ $t('title.faqSubtitle') }}
        </div>
        <div>
          <NcButton
            type="secondary"
            size="small"
            @click="navigateTo('https://nocodb.com/pricing#faq', { external: true, open: { target: '_blank' } })"
          >
            <div class="flex items-center gap-1.5">
              <GeneralIcon icon="ncExternalLink" class="h-4 w-4" />
              {{ $t('activity.goToPage') }}
            </div>
          </NcButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* ── Seat selector panel ── */
.nc-seat-selector-panel {
  @apply flex flex-col gap-4 py-5 px-8 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default;
  box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
}

/* ── Seat number input ── */
.nc-seat-input-wrapper {
  @apply flex items-center rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default overflow-hidden;
  @apply transition-colors duration-300;

  &:focus-within {
    @apply border-nc-content-brand;
    box-shadow: 0px 0px 0px 2px var(--nc-bg-default), 0px 0px 0px 4px var(--nc-content-brand);
  }
}

.nc-seat-input {
  @apply w-16 h-8 px-2 text-center text-sm font-semibold bg-transparent outline-none border-0;
  @apply text-nc-content-gray-emphasis;
  -moz-appearance: textfield;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}

/* ── Slider ── */
.nc-seat-slider {
  @apply w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none;
  background: linear-gradient(
    to right,
    var(--nc-content-brand) 0%,
    var(--nc-content-brand) var(--progress, 0%),
    var(--nc-bg-gray-medium) var(--progress, 0%),
    var(--nc-bg-gray-medium) 100%
  );

  &::-webkit-slider-thumb {
    @apply appearance-none rounded-full bg-nc-bg-default cursor-pointer;
    width: 18px;
    height: 18px;
    border: 2px solid var(--nc-content-brand);
    box-shadow: 0px 0px 0px 3px rgba(51, 102, 255, 0.12);
  }

  &::-moz-range-thumb {
    @apply rounded-full bg-nc-bg-default cursor-pointer border-0;
    width: 18px;
    height: 18px;
    border: 2px solid var(--nc-content-brand);
    box-shadow: 0px 0px 0px 3px rgba(51, 102, 255, 0.12);
  }

  &:focus::-webkit-slider-thumb {
    box-shadow: 0px 0px 0px 2px var(--nc-bg-default), 0px 0px 0px 4px var(--nc-content-brand);
  }
}

/* ── Preset track ── */
.nc-preset-track {
  @apply relative overflow-visible;
  height: 26px;
}

/* ── Preset chips ── */
.nc-seat-preset {
  @apply absolute top-0 h-6.5 px-2.5 rounded-[6px] text-xs font-medium cursor-pointer select-none;
  @apply bg-nc-bg-gray-light text-nc-content-gray-subtle transition-all duration-200;
  transform: translateX(-50%);

  &:hover:not(.active) {
    @apply bg-nc-bg-gray-medium;

    .nc-seat-preset-caret {
      border-bottom-color: var(--nc-bg-gray-medium);
    }
  }

  &.active {
    @apply bg-nc-fill-primary text-white;

    .nc-seat-preset-caret {
      border-bottom-color: var(--nc-fill-primary);
    }
  }
}

.nc-seat-preset-caret {
  @apply absolute transition-colors duration-200;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid var(--nc-bg-gray-light);
}

/* ── Plan card ── */
.nc-plan-card {
  @apply flex flex-col p-5 rounded-lg border-1 transition-all duration-300;
  border-color: var(--plan-border);

  &:hover {
    box-shadow: 0px 0px 8px 0px rgba(0, 0, 0, 0.06);
  }
}

/* ── Total row inside card ── */
.nc-plan-total-row {
  @apply flex items-center justify-between py-2.5 px-3 rounded-lg mt-3;
  background-color: var(--plan-bg-dark);
}
</style>
