<script setup lang="ts">
interface Props {
  title: string
  headers: Record<string, any>
  payload: unknown
  params?: Record<string, any>
}

const props = defineProps<Props>()

const copyPayloadContent = computed(() => {
  return typeof props.payload === 'object' ? JSON.stringify(props.payload, null, 2) : props.payload?.toString()
})

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
        <span class="text-gray-500 font-weight-bold text-small1">Header</span>
        <div class="log-details">
          <div v-for="(value, key) in headers" :key="key" class="log-detail-item">
            <NcTooltip class="text-small1 min-w-40" show-on-truncate-only>
              <template #title>{{ key }}</template>
              <span class="label"> {{ key }} </span>
            </NcTooltip>
            <NcTooltip class="text-small1 max-w-[calc(100%_-_160px)] truncate" show-on-truncate-only>
              <template #title>{{ value }}</template>
              <span class="value"> {{ value }}</span>
            </NcTooltip>
          </div>
        </div>
      </div>
      <div v-if="params && Object.keys(params).length" class="detail-params">
        <span class="text-gray-500 font-weight-bold text-small1">Parameter</span>
        <div class="log-details">
          <div v-for="(value, key) in params" :key="key" class="log-detail-item">
            <NcTooltip class="text-small1 min-w-40" show-on-truncate-only>
              <template #title>{{ key }}</template>
              <span class="label"> {{ key }}</span>
            </NcTooltip>
            <NcTooltip class="text-small1 max-w-[calc(100%_-_160px)]" show-on-truncate-only>
              <template #title>{{ value }}</template>
              <span class="value"> {{ value }}</span>
            </NcTooltip>
          </div>
        </div>
      </div>
      <div v-if="payload && Object.keys(payload).length" class="detail-payload -mt-1">
        <div class="text-sm text-gray-500 font-weight-bold pb-2 flex justify-between items-center">
          <span class="text-xs leading-[18px]">Payload</span>
          <GeneralCopyButton :content="copyPayloadContent" size="xs" class="!px-1" />
        </div>
        <LazyMonacoEditor
          :model-value="formattedPayload"
          class="min-w-full w-full flex-1 min-h-50 resize-y overflow-auto expanded-editor"
          hide-minimap
          disable-deep-compare
          read-only
          :monaco-config="{
            lineNumbers: 'on',
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
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
    @apply border-b border-nc-border-gray-medium px-3 py-2;
  }

  .content {
    @apply flex-1 overflow-auto nc-scrollbar-thin flex flex-col;

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
          @apply min-w-40 font-weight-600 text-gray-700 text-small1 lowercase;
        }

        .value {
          @apply min-w-0 text-nc-content-gray-subtle2 font-500 text-small1;
        }
      }
    }

    :deep(.monaco-editor) {
      @apply !outline-none;
    }

    .detail-params,
    .detail-headers,
    .detail-payload {
      @apply min-w-80;
    }
    .detail-payload {
      @apply flex-grow;
    }
  }
}
</style>
