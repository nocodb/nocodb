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
</template>
