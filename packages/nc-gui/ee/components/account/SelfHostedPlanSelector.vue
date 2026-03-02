<script lang="ts" setup>
import { OnPremPlanMeta, OnPremPlanOrder, type OnPremPlanTitles } from 'nocodb-sdk'

const emit = defineEmits<{
  (e: 'select', planId: string, priceId: string): void
}>()

const { t } = useI18n()

const { plans, paymentMode, loadPlans, getPlanPrice, getPlanPriceAmount } = useOnPremLicense()

const isLoadingPlans = ref(false)

const sortedPlans = computed(() =>
  [...plans.value].sort(
    (a, b) => (OnPremPlanOrder[a.title as OnPremPlanTitles] ?? 0) - (OnPremPlanOrder[b.title as OnPremPlanTitles] ?? 0),
  ),
)

const planMeta = (title: OnPremPlanTitles) => OnPremPlanMeta[title] || null

const selectPlan = (plan: (typeof plans.value)[0]) => {
  const price = getPlanPrice(plan, paymentMode.value)
  if (!price) {
    message.error(t('msg.error.priceNotFound'))
    return
  }
  emit('select', plan.id, price.id)
}

onMounted(async () => {
  if (plans.value.length === 0) {
    isLoadingPlans.value = true
    await loadPlans()
    isLoadingPlans.value = false
  }
})
</script>

<template>
  <div>
    <div class="flex items-center justify-center mb-6">
      <PaymentPlansSelectMode v-model:value="paymentMode" />
    </div>

    <div v-if="isLoadingPlans" class="flex items-center justify-center py-10">
      <GeneralLoader size="xlarge" />
    </div>

    <div v-else class="grid gap-4" :class="sortedPlans.length > 1 ? 'grid-cols-2' : 'grid-cols-1 max-w-[400px] mx-auto'">
      <div
        v-for="plan in sortedPlans"
        :key="plan.id"
        class="border rounded-xl p-6 flex flex-col transition-all hover:shadow-md"
        :style="{
          borderColor: planMeta(plan.title as OnPremPlanTitles)?.border || '#e5e7eb',
          backgroundColor: planMeta(plan.title as OnPremPlanTitles)?.bgLight || '#ffffff',
        }"
        :data-testid="`nc-self-hosted-plan-${plan.title}`"
      >
        <!-- Badge -->
        <div class="flex items-center gap-2 mb-4">
          <div
            class="px-2.5 py-1 rounded-md text-xs font-semibold"
            :style="{
              backgroundColor: planMeta(plan.title as OnPremPlanTitles)?.badgeBgColor,
              color: planMeta(plan.title as OnPremPlanTitles)?.badgeTextColor,
            }"
          >
            {{ $t(`objects.paymentPlan.${plan.title}`) }}
          </div>
        </div>

        <!-- Price -->
        <div class="flex items-baseline gap-1 mb-1">
          <span class="text-3xl font-bold text-nc-content-gray-emphasis"> ${{ getPlanPriceAmount(plan) }} </span>
          <span class="text-sm text-nc-content-gray-subtle"> / {{ $t('labels.userPerMonth') }} </span>
        </div>

        <div v-if="paymentMode === 'year'" class="text-xs text-nc-content-gray-muted mb-4">
          {{ $t('labels.billedAnnually') }}
        </div>
        <div v-else class="mb-4" />

        <!-- Descriptions -->
        <div v-if="plan.descriptions?.length" class="flex flex-col gap-2.5 mb-6">
          <div v-for="(desc, idx) in plan.descriptions" :key="idx" class="flex items-start gap-2 text-sm text-nc-content-gray">
            <GeneralIcon icon="circleCheckSolid" class="flex-none w-4 h-4 mt-0.5 text-green-600" />
            {{ desc }}
          </div>
        </div>

        <div class="mt-auto">
          <NcButton type="primary" size="small" class="w-full" @click.stop="selectPlan(plan)">
            {{ $t('labels.selectPlan') }}
          </NcButton>
        </div>
      </div>
    </div>

    <!-- Help & FAQ -->
    <NcDivider class="!my-8" />

    <div class="grid grid-cols-2 gap-6">
      <div class="flex flex-col gap-3">
        <div class="text-sm font-semibold text-nc-content-gray-emphasis">
          {{ $t('title.helpAndSupport') }}
        </div>
        <div class="text-small text-nc-content-gray-subtle">
          {{ $t('title.helpAndSupportSubtitle') }}
        </div>
        <div>
          <NcButton
            type="secondary"
            size="small"
            @click="navigateTo('https://nocodb.com/contact', { external: true, open: { target: '_blank' } })"
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
        <div class="text-small text-nc-content-gray-subtle">
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
