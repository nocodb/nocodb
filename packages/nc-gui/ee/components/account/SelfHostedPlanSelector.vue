<script lang="ts" setup>
import { OnPremPlanMeta, OnPremPlanTitles } from 'nocodb-sdk'

interface Props {
  initialSeats?: number
}

const props = withDefaults(defineProps<Props>(), {
  initialSeats: 0,
})

const emit = defineEmits<{
  (e: 'select', planId: string, priceId: string, quantity: number): void
}>()

const { t } = useI18n()

const { plans, paymentMode, loadPlans, getPlanPrice, getPlanPriceAmount } = useOnPremLicense()

const isLoadingPlans = ref(false)

const seatCount = computed(() => Math.max(1, props.initialSeats || 0))

const scaleSeatCount = computed(() => Math.max(3, seatCount.value))

const isFromInstance = computed(() => (props.initialSeats ?? 0) > 1)

const businessPlan = computed(() => plans.value.find((p) => p.title === OnPremPlanTitles.SELF_HOSTED_BUSINESS) ?? null)
const scalePlan = computed(() => plans.value.find((p) => p.title === OnPremPlanTitles.SELF_HOSTED_SCALE) ?? null)

const businessMeta = OnPremPlanMeta[OnPremPlanTitles.SELF_HOSTED_BUSINESS]
const scaleMeta = OnPremPlanMeta[OnPremPlanTitles.SELF_HOSTED_SCALE]
const enterpriseMeta = OnPremPlanMeta[OnPremPlanTitles.SELF_HOSTED_ENTERPRISE]

const businessDescriptions = computed(
  () =>
    businessPlan.value?.descriptions ?? [
      t('labels.businessDescUnlimitedEditors'),
      t('labels.businessDescPermissionsAdmin'),
      t('labels.businessDescSnapshotsWebhooks'),
      t('labels.businessDescSyncScripts'),
    ],
)

const scaleDescriptions = computed(
  () =>
    scalePlan.value?.descriptions ?? [
      t('labels.scaleDescEverythingInBusiness'),
      t('labels.scaleDescMultipleWorkspaces'),
      t('labels.scaleDescAuditTeamsRls'),
      t('labels.scaleDescMultiProviderAi'),
      t('labels.scaleDescMinSeatsAnnual'),
    ],
)

const enterpriseDescriptions = computed(() => [
  t('labels.enterpriseDescEverythingInBusiness'),
  t('labels.enterpriseDescScimRls'),
  t('labels.enterpriseDescAirgapped'),
  t('labels.enterpriseDescUnlimitedWorkspaces'),
  t('labels.enterpriseDescPrioritySupport'),
])

const selectBusiness = () => {
  if (!businessPlan.value) return
  const price = getPlanPrice(businessPlan.value, paymentMode.value)
  if (!price) {
    message.error(t('msg.error.priceNotFound'))
    return
  }
  emit('select', businessPlan.value.id, price.id, seatCount.value)
}

const selectScale = () => {
  if (!scalePlan.value) return
  const price = getPlanPrice(scalePlan.value, paymentMode.value)
  if (!price) {
    message.error(t('msg.error.priceNotFound'))
    return
  }
  emit('select', scalePlan.value.id, price.id, scaleSeatCount.value)
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
  <div class="flex flex-col">
    <!-- Billing period toggle -->
    <div class="flex items-center justify-center mb-6">
      <PaymentPlansSelectMode v-model:value="paymentMode" :discount="20" />
    </div>

    <div v-if="isLoadingPlans" class="flex items-center justify-center py-10">
      <GeneralLoader size="xlarge" />
    </div>

    <template v-else>
      <!-- Auto-bill notice -->
      <div class="nc-seat-info-panel" data-testid="nc-self-hosted-seat-info">
        <div class="flex items-start gap-3">
          <GeneralIcon icon="ncInfo" class="flex-none w-4 h-4 mt-0.5 text-nc-content-brand" />
          <div class="text-sm text-nc-content-gray leading-5">
            {{
              isFromInstance
                ? $t('labels.seatBillingNoteFromInstance', { count: seatCount }, seatCount)
                : $t('labels.seatBillingNoteDefault')
            }}
          </div>
        </div>
      </div>

      <!-- Plan cards -->
      <div class="grid grid-cols-3 gap-4 mt-6">
        <!-- Business — self-serve -->
        <div
          v-if="businessPlan"
          class="nc-plan-card"
          :style="{
            '--plan-border': businessMeta.border,
            '--plan-bg': businessMeta.bgLight,
            '--plan-bg-dark': businessMeta.bgDark,
            '--plan-badge-bg': businessMeta.badgeBgColor,
            '--plan-badge-text': businessMeta.badgeTextColor,
          }"
          data-testid="nc-self-hosted-plan-business"
        >
          <!-- Badge -->
          <div
            class="inline-flex px-2 py-0.75 rounded-[6px] text-sm font-bold w-fit"
            :style="{ backgroundColor: 'var(--plan-badge-bg)', color: 'var(--plan-badge-text)' }"
          >
            {{ $t('objects.paymentPlan.Self-hosted Business') }}
          </div>

          <!-- Price -->
          <div class="mt-4">
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-bold text-nc-content-gray-emphasis">${{ getPlanPriceAmount(businessPlan) }}</span>
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
              {{ $t('labels.fromNSeats', { count: seatCount }) }}
            </span>
            <span class="text-sm font-bold text-nc-content-gray-emphasis">
              ${{ getPlanPriceAmount(businessPlan) * seatCount }}
              <span class="text-xs font-normal text-nc-content-gray-muted">{{ $t('labels.perMonth') }}</span>
            </span>
          </div>

          <!-- Features -->
          <div class="flex flex-col gap-2.5 mt-4">
            <div
              v-for="(desc, idx) in businessDescriptions"
              :key="idx"
              class="flex items-start gap-2 text-sm text-nc-content-gray"
            >
              <GeneralIcon icon="circleCheckSolid" class="flex-none w-4 h-4 mt-0.5 text-nc-content-green-dark" />
              {{ desc }}
            </div>
          </div>

          <!-- CTA -->
          <div class="mt-auto pt-5">
            <NcButton
              type="primary"
              size="medium"
              class="!w-full"
              data-testid="nc-self-hosted-plan-business-buy"
              @click.stop="selectBusiness"
            >
              {{ $t('labels.selectPlanName', { plan: $t('objects.paymentPlan.Self-hosted Business') }) }}
            </NcButton>
          </div>
        </div>

        <!-- Scale — self-serve, min 3 seats -->
        <div
          v-if="scalePlan"
          class="nc-plan-card"
          :style="{
            '--plan-border': scaleMeta.border,
            '--plan-bg': scaleMeta.bgLight,
            '--plan-bg-dark': scaleMeta.bgDark,
            '--plan-badge-bg': scaleMeta.badgeBgColor,
            '--plan-badge-text': scaleMeta.badgeTextColor,
          }"
          data-testid="nc-self-hosted-plan-scale"
        >
          <!-- Badge -->
          <div
            class="inline-flex px-2 py-0.75 rounded-[6px] text-sm font-bold w-fit"
            :style="{ backgroundColor: 'var(--plan-badge-bg)', color: 'var(--plan-badge-text)' }"
          >
            {{ $t('objects.paymentPlan.Self-hosted Scale') }}
          </div>

          <!-- Price -->
          <div class="mt-4">
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-bold text-nc-content-gray-emphasis">${{ getPlanPriceAmount(scalePlan) }}</span>
              <span class="text-sm text-nc-content-gray-muted"> / {{ $t('labels.userPerMonth') }}</span>
            </div>

            <div class="text-xs text-nc-content-gray-muted mt-0.5">
              {{
                paymentMode === 'year' ? $t('labels.billedAnnuallyMinSeats', { count: 3 }) : $t('labels.minNSeats', { count: 3 })
              }}
            </div>
          </div>

          <!-- Total summary -->
          <div class="nc-plan-total-row">
            <span class="text-sm text-nc-content-gray-subtle">
              {{ $t('labels.fromNSeats', { count: scaleSeatCount }) }}
            </span>
            <span class="text-sm font-bold text-nc-content-gray-emphasis">
              ${{ getPlanPriceAmount(scalePlan) * scaleSeatCount }}
              <span class="text-xs font-normal text-nc-content-gray-muted">{{ $t('labels.perMonth') }}</span>
            </span>
          </div>

          <!-- Features -->
          <div class="flex flex-col gap-2.5 mt-4">
            <div v-for="(desc, idx) in scaleDescriptions" :key="idx" class="flex items-start gap-2 text-sm text-nc-content-gray">
              <GeneralIcon icon="circleCheckSolid" class="flex-none w-4 h-4 mt-0.5 text-nc-content-green-dark" />
              {{ desc }}
            </div>
          </div>

          <!-- CTA -->
          <div class="mt-auto pt-5">
            <NcButton
              type="primary"
              size="medium"
              class="!w-full"
              data-testid="nc-self-hosted-plan-scale-buy"
              @click.stop="selectScale"
            >
              {{ $t('labels.selectPlanName', { plan: $t('objects.paymentPlan.Self-hosted Scale') }) }}
            </NcButton>
          </div>
        </div>

        <!-- Enterprise — contact sales only -->
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
              data-testid="nc-self-hosted-plan-enterprise-contact"
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
/* ── Seat info panel ── */
.nc-seat-info-panel {
  @apply py-3 px-4 rounded-lg border-1 border-nc-border-brand bg-nc-bg-brand;
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
