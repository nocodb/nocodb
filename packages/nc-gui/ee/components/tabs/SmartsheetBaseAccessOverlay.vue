<script lang="ts" setup>
import { PlanFeatureTypes } from 'nocodb-sdk'

const { base, showBaseAccessRequestOverlay } = storeToRefs(useBase())

const { updateProject } = useBases()

const { navigateToPricing } = useEeConfig()

const handleConvertToSharedBase = async () => {
  try {
    await updateProject(base.value.id!, {
      default_role: '',
    })
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div v-if="showBaseAccessRequestOverlay" class="nc-smartsheet-access-request-overlay">
    <div class="nc-smartsheet-access-request-modal">
      <div class="flex flex-col gap-2 text-nc-content-gray-emphasis">
        <h2 class="my-0 text-subHeading2">This Private Base has been locked.</h2>
        <div class="text-body">To unlock, please upgrade to the Business plan or convert this Base to a Shared Base.</div>
      </div>
      <div class="flex flex-col gap-2">
        <NcButton
          type="primary"
          size="small"
          class="w-full"
          @click="navigateToPricing({ limitOrFeature: PlanFeatureTypes.FEATURE_PRIVATE_BASES })"
        >
          Upgrade to Business
        </NcButton>
        <NcButton type="text" size="small" class="w-full" @click="handleConvertToSharedBase">Convert to Shared Base</NcButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-smartsheet-access-request-overlay {
  @apply !pointer-events-auto absolute inset-0 bg-white/24 z-500 grid place-items-center px-4;
  backdrop-filter: blur(16px);

  .nc-smartsheet-access-request-modal {
    @apply p-6 rounded-2xl bg-white max-w-md flex flex-col gap-5;
    box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1);
  }
}
</style>
