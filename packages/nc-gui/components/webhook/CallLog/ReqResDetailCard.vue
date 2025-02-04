<script setup lang="ts">
interface Props {
  title: string
  headers: Record<string, any>
  payload: unknown
}

const props = defineProps<Props>()

const { copy } = useCopy()

const { t } = useI18n()

const copyPayload = async () => {
  try {
    await copy(typeof props.payload === 'object' ? JSON.stringify(props.payload, null, 2) : props.payload)
    message.success(t('msg.info.copiedToClipboard'))
  } catch (e) {
    message.error(e.message)
  }
}
</script>

<template>
  <div class="detail-card">
    <div class="detail-title font-weight-bold">{{ title }}</div>
    <div v-if="headers" class="detail-headers">
      <span class="text-sm text-gray-500 font-weight-bold">Header</span>
      <div class="log-details">
        <div v-for="(value, key) in headers" class="log-detail-item">
          <span class="label">{{ key }}</span>
          <span class="value">{{ value }}</span>
        </div>
      </div>
    </div>
    <div v-if="payload" class="detail-payload">
      <div class="text-sm text-gray-500 font-weight-bold pb-2 flex justify-between">
        Payload
        <GeneralIcon icon="copy" class="cursor-pointer" @click="copyPayload" />
      </div>
      <LazyMonacoEditor
        :model-value="payload"
        class="min-w-full w-full h-50 resize overflow-auto expanded-editor"
        hide-minimap
        disable-deep-compare
        read-only
        :monaco-config="{
          lineNumbers: 'on',
        }"
        @keydown.enter.stop
        @keydown.alt.stop
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.detail-card {
  @apply flex flex-col w-full border-1 border-gray-200 rounded-lg bg-gray-50;
  & > div:not(:last-child) {
    @apply border-b border-gray-200;
  }

  & > div {
    @apply p-3;
  }
  .log-details {
    @apply flex flex-col gap-2 mt-2;
    .log-detail-item {
      @apply flex flex-row w-full;
      .label {
        @apply min-w-40 font-bold overflow-ellipsis whitespace-nowrap overflow-hidden;
      }

      .value {
        @apply min-w-0 text-gray-500 overflow-ellipsis whitespace-nowrap overflow-hidden;
      }
    }
  }
}
</style>
