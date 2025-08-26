<script lang="ts" setup>
const orgStore = useOrg()

const { org } = storeToRefs(orgStore)

provide(IsOrgBillingInj, ref(true))

const { isOrgBilling } = useEeConfig()

onMounted(() => {
  isOrgBilling.value = true
})

onBeforeUnmount(() => {
  isOrgBilling.value = false
})
</script>

<template>
  <div class="flex flex-col" data-testid="nc-admin-billing">
    <div class="nc-breadcrumb px-2">
      <div class="nc-breadcrumb-item">
        {{ org.title }}
      </div>
      <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
      <div class="nc-breadcrumb-item active">
        {{ $t('general.billing') }}
      </div>
    </div>
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="dollerSign" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('general.billing') }}
        </span>
      </template>
    </NcPageHeader>

    <PaymentBillingPage is-org class="flex-1 !h-[calc(100vh_-_100px)]" />
  </div>
</template>
