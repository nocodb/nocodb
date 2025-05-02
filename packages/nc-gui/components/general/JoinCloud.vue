<script lang="ts" setup>
import type { CloudFeaturesType } from '~/lib/types'

const { $api } = useNuxtApp()

const { cloudFeatures: _cloudFeatures } = useEeConfig()

const isLoading = ref(false)

const error = ref(false)

/**
 * This hardcoded list will be used as fallback in case of api error
 * Todo: @ramesh udpate coming soon once that feature is available
 */
const descriptions: CloudFeaturesType[] = [
  {
    Title: 'SAML based Single Sign-On',
    Highlight: true,
  },
  {
    Title: 'Form view branding',
  },
  {
    Title: 'Personal views',
  },
  {
    'Title': 'Extensions',
    'Coming Soon': true,
  },
  {
    'Title': 'Scripts',
    'Coming Soon': true,
  },
  {
    'Title': 'AI Integrations',
    'Coming Soon': true,
    'Highlight': true,
  },
]

const cloudFeatures = computed(() => {
  if (error.value && !_cloudFeatures.value) return descriptions

  return _cloudFeatures.value
})

const onMouseover = async () => {
  if (isLoading.value) return

  if (cloudFeatures.value.length && !error.value) {
    isLoading.value = false
    return
  }

  error.value = false
  isLoading.value = true

  try {
    const res = await $api.utils.cloudFeatures()

    _cloudFeatures.value = res
  } catch (e: any) {
    error.value = true
    console.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-row items-center w-full bg-white rounded-lg border-1 border-brand-500 shadow-sm mb-0.5 overflow-hidden">
    <a
      v-e="['c:navbar:join-cloud']"
      class="flex flex-grow !no-underline items-center justify-center border-r-1 h-full hover:bg-gray-100"
      href="https://app.nocodb.com/#/signin?utm_source=OSS&utm_medium=OSS&utm_campaign=OSS&utm_content=OSS"
    >
      <div class="px-1 text-gray-500 prose-sm" style="line-height: 1.3125rem">Try NocoDB Cloud</div>
    </a>

    <a-tooltip arrow-point-at-center overlay-class-name="nc-join-cloud-tooltip">
      <NcButton type="text" size="small" class="!rounded-l-none !rounded-r-lg" @mouseover="onMouseover">
        <GeneralIcon icon="help" class="!text-lg -mt-0.5 text-gray-700" />
      </NcButton>
      <template #title>
        <div class="w-70.5 bg-transparent overflow-hidden rounded-2xl shadow border-1 border-nc-border-gray-medium">
          <div class="p-4 bg-white gap-4 inline-flex flex-col w-full">
            <div class="flex items-center gap-3">
              <div class="text-base text-nc-content-gray-emphasis font-bold flex-1">NocoDB Cloud</div>
              <div class="text-caption px-1 rounded-md bg-nc-bg-brand text-nc-content-brand">Usage based</div>
            </div>

            <div class="text-sm font-bold text-nc-content-gray-emphasis">Includes</div>

            <div v-if="!isLoading" class="flex flex-col gap-2">
              <div
                v-for="(feature, idx) of cloudFeatures"
                :key="idx"
                class="flex items-start text-nc-content-gray text-sm font-weight-500"
              >
                <span class="mr-2 h-5 inline-flex items-center">
                  <span class="rounded text-nc-content-brand bg-nc-bg-brand inline-flex items-center justify-center h-4 w-4">
                    <GeneralIcon icon="ncCheck" class="h-3 w-3" />
                  </span>
                </span>
                <span class="relative">
                  {{ feature.Title }}

                  <div v-if="feature.Highlight" class="nc-plan-description-gradient"></div>
                </span>
                <span v-if="feature['Coming Soon']" class="flex-1 inline-flex justify-end">
                  <span class="inline-block px-1 rounded-md bg-nc-bg-gray-medium text-sm text-nc-content-gray-subtle2">
                    Soon
                  </span>
                </span>
              </div>
            </div>
            <div v-else class="h-35 grid place-items-center">
              <GeneralLoader size="large" />
            </div>

            <div class="flex flex-col gap-2">
              <div class="text-xs leading-[18px] font-normal text-nc-content-gray-muted text-center">
                (no credit card required)
              </div>
              <a href="https://app.nocodb.com/#/signin" target="_blank" class="!no-underline" rel="noopener">
                <NcButton type="secondary" class="w-full">Start for Free</NcButton>
              </a>
            </div>
          </div>
        </div>
      </template>
    </a-tooltip>
  </div>
</template>

<style lang="scss" scoped>
.nc-plan-description-gradient {
  @apply absolute rounded-[30px] inset-0 z-0 pointer-events-none;

  background: linear-gradient(90deg, rgba(255, 255, 255, 0.2) 0%, rgba(252, 58, 198, 0.2) 47.08%, rgba(255, 255, 255, 0.2) 100%);
  filter: blur(2px);
}
</style>

<style lang="scss">
.nc-join-cloud-tooltip {
  @apply max-w-none;

  .ant-tooltip-inner {
    @apply !bg-transparent !p-0 rounded-2xl;
  }
  .ant-tooltip-arrow-content {
    @apply !bg-white;
  }
}
</style>
