<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

const { isUIAllowed } = useRoles()
const { base, showBaseAccessRequestOverlay } = storeToRefs(useBase())

const { updateProject } = useBases()

const { isWsOwner, navigateToPricing } = useEeConfig()

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
        <h2 class="my-0 text-subHeading2">{{ $t('title.thisPrivateBaseHasBeenLocked') }}</h2>
        <div class="text-body">
          {{ $t('title.thisPrivateBaseHasBeenLockedSubtext', { plan: PlanTitles.BUSINESS }) }}
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <NcButton
          type="primary"
          size="small"
          class="w-full"
          @click="navigateToPricing({ limitOrFeature: PlanFeatureTypes.FEATURE_PRIVATE_BASES, ctaPlan: PlanTitles.BUSINESS })"
        >
          {{
            isWsOwner
              ? $t('labels.upgradeToPlan', {
                  plan: PlanTitles.BUSINESS,
                })
              : $t('general.requestUpgrade')
          }}
        </NcButton>
        <NcButton
          v-if="isUIAllowed('baseMiscSettings')"
          type="text"
          size="small"
          class="w-full"
          @click="handleConvertToSharedBase"
        >
          {{ $t('activity.convertToSharedBase') }}
        </NcButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-smartsheet-access-request-overlay {
  @apply !pointer-events-auto absolute inset-0 z-500 bg-nc-bg-default/24  grid place-items-center px-4;
  backdrop-filter: blur(16px);

  .nc-smartsheet-access-request-modal {
    @apply p-6 rounded-2xl bg-nc-bg-default max-w-md flex flex-col gap-5 dark:(border-1 border-nc-border-gray-medium);
    box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1);
  }
}
</style>
