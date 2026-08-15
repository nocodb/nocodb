<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSsoError } from '~/composables/useSsoError'

const props = defineProps<{
  title?: string
  message?: string
  /** Failure bucket, paired with errorRef so support can find the matching log line. */
  code?: string
  errorRef?: string
}>()

const { t } = useI18n()

const { clearError } = useSsoError()

const supportCode = computed(() => [props.code, props.errorRef].filter(Boolean).join(' · '))

const handleRetry = () => {
  clearError()
}
</script>

<template>
  <div class="flex flex-col items-center justify-center nc-min-h-screen bg-nc-bg-gray-extralight">
    <div class="w-full max-w-md p-8 space-y-8 bg-nc-bg-default rounded-lg shadow">
      <div class="text-center">
        <h1 class="text-2xl font-bold text-nc-content-gray-emphasis">
          {{ title || t('msg.noAccess') }}
        </h1>
        <p class="mt-2 text-sm text-nc-content-gray-subtle2">
          {{ message || t('msg.noAccessDescription') }}
        </p>

        <div v-if="supportCode" class="mt-6 text-left">
          <p class="text-bodySm text-nc-content-gray-subtle2">
            {{ t('msg.sso.shareCode') }}
          </p>
          <div
            class="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-nc-bg-gray-light border-1 border-nc-border-gray-medium"
          >
            <span class="flex-1 font-mono text-bodySm text-nc-content-gray break-all" data-testid="nc-sso-error-code">
              {{ supportCode }}
            </span>
            <GeneralCopyButton :content="supportCode" />
          </div>
        </div>

        <NcButton class="mt-4" type="primary" size="medium" data-testid="nc-sso-error-retry" @click="handleRetry">
          {{ t('msg.tryAgain') }}
        </NcButton>
      </div>
    </div>
  </div>
</template>
