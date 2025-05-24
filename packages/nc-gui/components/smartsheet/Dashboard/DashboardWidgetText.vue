<script setup lang="ts">
import type { TextWidgetConfig, WidgetType } from 'nocodb-sdk'
import { marked } from 'marked'

interface Props {
  widget?: WidgetType
  config?: TextWidgetConfig
  isReadonly?: boolean
}

const props = defineProps<Props>()

// Render markdown content safely
const renderedMarkdown = computed(() => {
  if (props.config?.format !== 'markdown' || !props.config?.content) return ''

  try {
    return marked(props.config.content)
  } catch (error) {
    console.error('Error rendering markdown:', error)
    return `<p class="text-red-500">Error rendering markdown content</p>`
  }
})
</script>

<template>
  <div class="text-widget">
    <div v-if="!config?.content" class="no-content">
      <GeneralIcon icon="text" class="text-4xl text-gray-400 mb-2" />
      <p class="text-gray-500 text-sm">No content available</p>
    </div>

    <div v-else class="content-container">
      <!-- Markdown content -->
      <div v-if="config.format === 'markdown'" class="markdown-content" v-html="renderedMarkdown" />

      <!-- HTML content -->
      <div v-else-if="config.format === 'html'" class="html-content" v-html="config.content" />

      <!-- Plain text content -->
      <div v-else class="plain-content">
        {{ config.content }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.text-widget {
  @apply w-full h-full overflow-auto;
}

.no-content {
  @apply w-full h-full flex flex-col items-center justify-center;
}

.content-container {
  @apply w-full h-full;
}

.markdown-content,
.html-content {
  @apply prose prose-sm max-w-none;

  :deep(h1) {
    @apply text-lg font-semibold mb-3;
  }
  :deep(h2) {
    @apply text-base font-semibold mb-2;
  }
  :deep(h3) {
    @apply text-sm font-semibold mb-2;
  }
  :deep(p) {
    @apply mb-2 text-sm;
  }
  :deep(ul, ol) {
    @apply mb-2 text-sm pl-4;
  }
  :deep(blockquote) {
    @apply border-l-4 border-gray-300 pl-4 text-gray-600 italic;
  }
  :deep(code) {
    @apply bg-gray-100 px-1 rounded text-xs;
  }
  :deep(pre) {
    @apply bg-gray-100 p-2 rounded text-xs overflow-auto;
  }
  :deep(a) {
    @apply text-blue-600 hover:text-blue-800;
  }
}

.plain-content {
  @apply text-sm leading-relaxed whitespace-pre-wrap;
}
</style>
