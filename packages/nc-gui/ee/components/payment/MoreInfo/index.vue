<script lang="ts" setup>
interface Props {
  title?: string
  subtitle?: string
}

defineProps<Props>()
</script>

<template>
  <div class="flex items-stretch children:w-1/2 gap-8">
    <PaymentMoreInfoCard :title="$t('title.helpAndSupport')" :subtitle="$t('title.helpAndSupportSubtitle')">
      <template #action>
        <nuxt-link no-ref to="mailto:support@nocodb.com" target="_blank">
          <NcButton type="secondary" size="small">
            {{ $t('labels.contactSales') }}
          </NcButton>
        </nuxt-link>
      </template>
    </PaymentMoreInfoCard>

    <PaymentMoreInfoCard :title="$t('title.faq')" :subtitle="$t('title.faqSubtitle')">
      <template #action>
        <nuxt-link to="https://nocodb.com/#faq" target="_blank" rel="noopener noreferrer">
          <NcButton type="secondary" icon-position="right" inner-class="!gap-2" size="small">
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
