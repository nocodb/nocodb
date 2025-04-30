<script lang="ts" setup>
interface Props {
  title?: string
  subtitle?: string
}

defineProps<Props>()

const { navigateToPricing } = useEeConfig()
</script>

<template>
  <div class="flex items-stretch children:w-1/2 gap-8">
    <PaymentMoreInfoCard :title="$t('title.helpAndSupport')" :subtitle="$t('title.helpAndSupportSubtitle')">
      <template #action>
        <nuxt-link no-ref to="mailto:support@nocodb.com" target="_blank">
          <NcButton type="secondary" size="small" inner-class="!gap-2">
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
        <nuxt-link @click="navigateToPricing({ autoScroll: 'faq' })">
          <NcButton type="secondary" inner-class="!gap-2" size="small">
            <template #icon>
              <GeneralIcon icon="ncExternalLink" />
            </template>
            {{ $t('activity.goToPage') }}
          </NcButton>
        </nuxt-link>
      </template>
    </PaymentMoreInfoCard>
  </div>
</template>
