<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSsoError } from '~/composables/useSsoError'

defineProps<{
  message?: string
}>()
const { t } = useI18n()
const { clearError } = useSsoError()

const handleRetry = () => {
  clearError()
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-nc-bg-gray-extralight">
    <div class="w-full max-w-md p-8 space-y-8 bg-nc-bg-default rounded-lg shadow">
      <div class="text-center">
        <h1 class="text-2xl font-bold text-nc-content-gray-emphasis">
          {{ t('msg.noAccess') }}
        </h1>
        <p class="mt-2 text-sm text-nc-content-gray-subtle2">
          {{ message || t('msg.noAccessDescription') }}
        </p>
        <NcButton class="mt-4" type="primary" size="medium" @click="handleRetry">
          {{ t('msg.tryAgain') }}
        </NcButton>
      </div>
    </div>
  </div>
</template>
