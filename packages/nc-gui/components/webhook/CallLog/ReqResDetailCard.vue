<script setup lang="ts">
interface Props {
  title: string
  headers: Record<string, any>
  payload: unknown
  params?: Record<string, any>
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

const formattedPayload = computed(() => {
  try {
    return typeof props.payload === 'object'
      ? JSON.stringify(props.payload, null, 2)
      : JSON.stringify(JSON.parse(props.payload), null, 2)
  } catch {
    return props.payload
  }
})
</script>

<template>
  <div class="detail-card">
    <div class="detail-title font-weight-bold">{{ title }}</div>
    <div class="content">
      <div v-if="headers" class="detail-headers">
        <span class="text-gray-500 font-weight-bold text-xs leading-[18px]">Header</span>
        <div class="log-details">
          <div v-for="(value, key) in headers" :key="key" class="log-detail-item">
            <nc-tooltip class="text-small1 min-w-40">
              <template #title>{{ key }}</template>
              <span class="label"> {{ key }}</span>
            </nc-tooltip>
            <nc-tooltip class="text-small1">
              <template #title>{{ value }}</template>
              <span class="value"> {{ value }}</span>
            </nc-tooltip>
          </div>
        </div>
      </div>
      <div v-if="params && Object.keys(params).length" class="detail-params">
        <span class="text-gray-500 font-weight-bold text-xs leading-[18px]">Params</span>
        <div class="log-details">
          <div v-for="(value, key) in params" :key="key" class="log-detail-item">
            <nc-tooltip class="text-small1 min-w-40">
              <template #title>{{ key }}</template>
              <span class="label"> {{ key }}</span>
            </nc-tooltip>
            <nc-tooltip class="text-small1">
              <template #title>{{ value }}</template>
              <span class="value"> {{ value }}</span>
            </nc-tooltip>
          </div>
        </div>
      </div>
      <div v-if="payload && Object.keys(payload).length" class="detail-payload">
        <div class="text-sm text-gray-500 font-weight-bold pb-2 flex justify-between">
          <span class="text-xs leading-[18px]">Payload</span>
          <GeneralIcon icon="copy" class="cursor-pointer" @click="copyPayload" />
        </div>
        <LazyMonacoEditor
          :model-value="formattedPayload"
          class="min-w-full w-full h-50 resize overflow-auto expanded-editor"
          hide-minimap
          disable-deep-compare
          read-only
          :monaco-config="{
            lineNumbers: 'on',
          }"
          :monaco-custom-theme="{
            base: 'vs',
            inherit: true,
            rules: [],
            colors: {
              'editor.background': '#f9f9fa',
            },
          }"
          @keydown.enter.stop
          @keydown.alt.stop
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.detail-card {
  @apply flex flex-col w-full border-1 border-gray-200 rounded-lg bg-gray-50 h-full;

  & > .detail-title {
    @apply border-b border-gray-200  px-3 py-2;
  }

  .content {
    @apply flex-grow max-h-117 overflow-auto flex flex-col;

    & > div:not(:last-child) {
      @apply border-b border-gray-200;
    }

    & > div {
      @apply px-3 py-2;
    }

    .log-details {
      @apply flex flex-col gap-1 mt-2;
      .log-detail-item {
        @apply flex flex-row w-full;
        .label {
          @apply min-w-40 font-weight-600 text-gray-700 overflow-ellipsis whitespace-nowrap overflow-hidden text-small1 lowercase overflow-ellipsis whitespace-nowrap overflow-hidden;
        }

        .value {
          @apply min-w-0 overflow-ellipsis whitespace-nowrap overflow-hidden text-gray-600  text-small1;
        }
      }
    }

    :deep(.monaco-editor) {
      @apply !outline-none;
    }

    .detail-params,
    .detail-headers {
      @apply flex-grow;
    }
  }
}
</style>
