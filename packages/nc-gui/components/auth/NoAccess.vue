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
  <div class="flex flex-col items-center justify-center min-h-screen bg-gray-50">
    <div class="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow">
      <div class="text-center">
        <h1 class="text-2xl font-bold text-gray-900">
          {{ t('msg.noAccess') }}
        </h1>
        <p class="mt-2 text-sm text-gray-600">
          {{ message || t('msg.noAccessDescription') }}
        </p>
        <NcButton class="mt-4" type="primary" size="medium" @click="handleRetry">
          {{ t('msg.tryAgain') }}
        </NcButton>
      </div>
    </div>
  </div>
</template>
