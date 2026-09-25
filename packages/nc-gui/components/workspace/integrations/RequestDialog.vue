<script lang="ts" setup>
import type { VNodeRef } from 'vue'

// Extracted so the base settings pane can offer the same request flow as the
// workspace tab. State lives in the integration store, so both hosts share one
// dialog rather than each keeping a copy of the markup.
const { requestIntegration, saveIntegrationRequest } = useIntegrationStore()

const focusTextArea: VNodeRef = (el) => el && (el as any)?.focus?.()
</script>

<template>
  <NcModal v-model:visible="requestIntegration.isOpen" centered size="medium" @keydown.esc="requestIntegration.isOpen = false">
    <div v-show="requestIntegration.isOpen" class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-4">
        <div class="text-base font-bold text-nc-content-gray">{{ $t('labels.requestIntegration') }}</div>
        <NcButton size="small" type="text" @click="requestIntegration.isOpen = false">
          <GeneralIcon icon="close" class="text-nc-content-gray-subtle2" />
        </NcButton>
      </div>

      <a-textarea
        :ref="focusTextArea"
        v-model:value="requestIntegration.msg"
        class="!rounded-md !text-sm !min-h-[120px] max-h-[500px] nc-scrollbar-thin"
        size="large"
        hide-details
        :placeholder="$t('placeholder.requestIntegration')"
      />

      <div class="flex items-center justify-end gap-3">
        <NcButton size="small" type="secondary" @click="requestIntegration.isOpen = false">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton
          :disabled="!requestIntegration.msg?.trim()"
          :loading="requestIntegration.isLoading"
          size="small"
          @click="saveIntegrationRequest(requestIntegration.msg)"
        >
          {{ $t('general.submit') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
