<script lang="ts" setup>
const { paymentState } = usePaymentStoreOrThrow()
</script>

<template>
  <div>
    <div v-if="paymentState === PaymentState.SELECT_PLAN" class="flex flex-col gap-8">
      <PaymentPlans />
      <div class="w-[70%] max-w-[640px] mx-auto">
        <NcDivider class="!my-0" />
      </div>
      <div class="flex items-stretch children:w-1/2 gap-8">
        <PaymentMoreInfoCard :title="$t('title.helpAndSupport')" :subtitle="$t('title.helpAndSupportSubtitle')">
          <template #action>
            <NcButton type="secondary">
              {{ $t('labels.contactSales') }}
            </NcButton>
          </template>
        </PaymentMoreInfoCard>

        <PaymentMoreInfoCard :title="$t('title.faq')" :subtitle="$t('title.faqSubtitle')">
          <template #action>
            <NcButton type="secondary" icon-position="right" inner-class="!gap-2">
              <template #icon>
                <GeneralIcon icon="ncExternalLink" />
              </template>
              {{ $t('activity.goToPage') }}
            </NcButton>
          </template>
        </PaymentMoreInfoCard>
      </div>
    </div>
    <PaymentPay v-else-if="paymentState === PaymentState.PAYMENT" />
  </div>
</template>
