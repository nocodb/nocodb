<script lang="ts" setup>
const route = useRoute()

const workspaceId = computed(() => (route.params.workspaceId ?? '') as string)
</script>

<template>
  <div class="h-full flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="ncDollarSign" class="flex-none text-[20px] h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true"> {{ $t('general.billing') }} </span>
      </template>
    </NcPageHeader>
    <PaymentBillingPage :workspace-id="workspaceId" class="!h-[calc(100vh_-_88px)]" />
  </div>
</template>
