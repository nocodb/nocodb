<script lang="ts" setup>
interface Props {
  title?: string
  subtitle?: string
}

defineProps<Props>()

const isOrgBilling = inject(IsOrgBillingInj, ref(false))

const { navigateToPricing } = useEeConfig()

const handleGoToPage = () => {
  if (isOrgBilling.value) {
    navigateTo('https://nocodb.com/pricing#faq', { external: true, open: navigateToBlankTargetOpenOption })
  } else {
    navigateToPricing({ autoScroll: 'faq', triggerEvent: false })
  }
}
</script>

<template>
  <div class="flex items-stretch children:w-1/2 gap-8">
    <PaymentMoreInfoCard :title="$t('title.helpAndSupport')" :subtitle="$t('title.helpAndSupportSubtitle')">
      <template #action>
        <nuxt-link no-ref to="mailto:support@nocodb.com" target="_blank">
          <NcButton v-e="['c:payment:billing:contact-sales']" type="secondary" size="small" inner-class="!gap-2">
            <template #icon>
              <GeneralIcon icon="ncMail" />
            </template>
            {{ $t('labels.contactSales') }}
          </NcButton>
        </nuxt-link>
      </template>
    </PaymentMoreInfoCard>

    <PaymentMoreInfoCard :title="$t('title.faq')" :subtitle="$t('title.faqSubtitle')">
      <template #action>
        <NcButton v-e="['c:payment:billing:faq']" type="secondary" inner-class="!gap-2" size="small" @click="handleGoToPage">
          <template #icon>
            <GeneralIcon icon="ncExternalLink" />
          </template>
          {{ $t('activity.goToPage') }}
        </NcButton>
      </template>
    </PaymentMoreInfoCard>
  </div>
</template>
