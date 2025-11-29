<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const props = defineProps<Props>()

// Define Monaco Editor as an async component
const MonacoEditor = defineAsyncComponent(() => import('~/components/monaco/Editor.vue'))

interface Props {
  title: string
  data: Record<string, any>
  copyContent?: string
}

const formattedData = computed(() => {
  try {
    return typeof props.data === 'object' ? JSON.stringify(props.data, null, 2) : JSON.stringify(JSON.parse(props.data), null, 2)
  } catch {
    return props.data
  }
})

const copyContent = computed(() => {
  return props.copyContent || formattedData.value
})
</script>

<template>
  <div class="detail-card">
    <div class="detail-title font-weight-bold">{{ title }}</div>
    <div class="content">
      <div v-if="data && Object.keys(data).length" class="detail-payload">
        <div class="text-sm text-nc-content-gray-muted font-weight-bold pb-2 flex justify-between items-center">
          <span class="text-xs leading-[18px]">Data</span>
          <GeneralCopyButton :content="copyContent" size="xs" class="!px-1" />
        </div>
        <Suspense>
          <template #default>
            <MonacoEditor
              :model-value="formattedData"
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
          </template>
          <template #fallback>
            <div class="min-h-50 w-full flex items-center justify-center bg-nc-bg-gray-extralight">
              <div class="text-center">
                <a-spin size="large" />
                <div class="mt-4 text-nc-content-gray-subtle2">Loading Monaco Editor...</div>
              </div>
            </div>
          </template>
        </Suspense>
      </div>
      <div v-else class="detail-payload p-4 text-nc-content-gray-subtle2 text-center">No data available</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.detail-card {
  @apply flex flex-col w-full border-1 border-nc-border-gray-medium rounded-lg bg-nc-bg-gray-extralight h-full;

  & > .detail-title {
    @apply border-b border-nc-border-gray-medium px-3 py-2;
  }

  .content {
    @apply flex-1 overflow-auto nc-scrollbar-thin flex flex-col;

    & > div:not(:last-child) {
      @apply border-b border-nc-border-gray-medium;
    }

    & > div {
      @apply px-3 py-2;
    }

    :deep(.monaco-editor) {
      @apply !outline-none;
    }

    .detail-payload {
      @apply flex-grow min-w-80;
    }
  }
}
</style>
