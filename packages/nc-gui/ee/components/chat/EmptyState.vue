<script setup lang="ts">
import type { ChatAttachmentType } from 'nocodb-sdk'

const emit = defineEmits<{
  prompt: [text: string, files?: ChatAttachmentType[]]
}>()

const { t } = useI18n()

const chatStore = useChatStore()
const { emptySuggestions, isLoadingSuggestions } = storeToRefs(chatStore)

type RecommendationTab = 'recommended' | 'ask' | 'analyze' | 'build'

const activeTab = ref<RecommendationTab>('recommended')

const tabs: { key: RecommendationTab; label: string }[] = [
  { key: 'recommended', label: t('labels.chatRecommended') },
  { key: 'ask', label: t('labels.chatAsk') },
  { key: 'analyze', label: t('labels.chatAnalyze') },
  { key: 'build', label: t('labels.chatBuild') },
]

const headings: Record<RecommendationTab, string> = {
  recommended: t('labels.chatHeadingRecommended'),
  ask: t('labels.chatHeadingAsk'),
  analyze: t('labels.chatHeadingAnalyze'),
  build: t('labels.chatHeadingBuild'),
}

const SUGGESTION_COUNT = 3

const currentSuggestions = computed(() => {
  return emptySuggestions.value.get(activeTab.value) || []
})

// Always return exactly SUGGESTION_COUNT items to prevent layout shift
const displaySuggestions = computed(() => {
  const items = currentSuggestions.value.slice(0, SUGGESTION_COUNT)
  while (items.length < SUGGESTION_COUNT) items.push('')
  return items
})

const emptyInputRef = ref<{ uploadFiles: (files: FileList | File[]) => Promise<void>; hasFiles: boolean; fileNames: string[] }>()

const uploadFiles = (files: FileList | File[]) => emptyInputRef.value?.uploadFiles(files)

defineExpose({ uploadFiles })

const fileNames = computed(() => emptyInputRef.value?.fileNames ?? [])

const fetchCurrentTab = () => chatStore.fetchSuggestions(activeTab.value, fileNames.value.length ? fileNames.value : undefined)

watch(activeTab, fetchCurrentTab, { immediate: true })

watch(
  fileNames,
  (names, oldNames) => {
    // Re-fetch when files change (added or removed) — clear all cached tabs so they refresh with file context
    if (names.length !== oldNames?.length || names.some((n, i) => n !== oldNames?.[i])) {
      emptySuggestions.value.clear()
      fetchCurrentTab()
    }
  },
  { deep: true },
)

const handleSuggestionClick = (suggestion: string) => {
  emit('prompt', suggestion)
}
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full px-6">
    <div class="max-w-800px w-full mx-auto my-auto">
      <div class="flex justify-center pt-2 pb-1">
        <div class="nc-chat-hero">
          <GeneralIcon icon="ncAutoAwesome" class="nc-chat-hero-star" />
          <GeneralIcon icon="ncAutoAwesome" class="nc-chat-hero-star-s1" />
          <GeneralIcon icon="ncAutoAwesome" class="nc-chat-hero-star-s2" />
        </div>
      </div>

      <div class="text-center py-3 text-nc-content-gray-emphasis text-subHeading1">
        {{ headings[activeTab] }}
      </div>

      <ChatInput
        ref="emptyInputRef"
        class="!px-0 !py-2"
        @send="(content: string, files?: ChatAttachmentType[]) => emit('prompt', content, files)"
      />

      <div class="px-1 mt-1">
        <div class="flex gap-3 border-b-1 border-nc-border-gray-medium">
          <div
            v-for="tab in tabs"
            :key="tab.key"
            v-e="['c:chat:empty-tab', { tab: tab.key }]"
            class="cursor-pointer text-body py-2 transition-colors"
            :class="
              activeTab === tab.key
                ? 'nc-chat-tab-active text-nc-content-gray-emphasis'
                : 'text-nc-content-gray-subtle hover:text-nc-content-gray'
            "
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </div>
        </div>
        <div class="flex flex-col">
          <template v-if="isLoadingSuggestions || !currentSuggestions.length">
            <div v-for="i in SUGGESTION_COUNT" :key="`shimmer-${i}`" class="nc-chat-suggestion-row">
              <a-skeleton class="nc-chat-suggestion-skeleton" active :title="true" :paragraph="false" />
            </div>
          </template>
          <template v-else>
            <div
              v-for="(suggestion, index) in displaySuggestions"
              :key="`${activeTab}-${index}`"
              v-e="suggestion ? ['c:chat:empty-suggestion'] : undefined"
              class="nc-chat-suggestion-row"
              :class="suggestion ? 'cursor-pointer text-nc-content-gray' : 'invisible'"
              @click="suggestion && handleSuggestionClick(suggestion)"
            >
              {{ suggestion || '&nbsp;' }}
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-chat-tab-active {
  @apply relative;

  &::after {
    content: '';
    @apply absolute bottom-0 left-0 right-0 h-0.5 bg-nc-content-gray-emphasis rounded-full;
    margin-bottom: -1px;
  }
}

.nc-chat-suggestion-row {
  @apply min-h-11 flex items-center px-1 py-2.5 border-b-1 border-nc-border-gray-light text-body;
}

.nc-chat-suggestion-skeleton {
  :deep(.ant-skeleton-title) {
    @apply !m-0 !h-4.5 !w-full;
  }
}

.nc-chat-hero {
  @apply relative flex items-center justify-center text-nc-content-brand;
  width: 48px;
  height: 48px;

  .nc-chat-hero-star {
    @apply !w-9 !h-9;
    animation: nc-star-pulse 3s ease-in-out infinite;
  }

  .nc-chat-hero-star-s1 {
    @apply !w-3.5 !h-3.5 absolute;
    top: 0;
    right: -2px;
    opacity: 0.5;
    animation: nc-star-twinkle 2.4s ease-in-out infinite 0.5s;
  }

  .nc-chat-hero-star-s2 {
    @apply !w-2.5 !h-2.5 absolute;
    bottom: 4px;
    left: -2px;
    opacity: 0.4;
    animation: nc-star-twinkle 3s ease-in-out infinite 1.3s;
  }
}

@keyframes nc-star-pulse {
  0%,
  100% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.1) rotate(8deg);
  }
}

@keyframes nc-star-twinkle {
  0%,
  100% {
    transform: scale(0.7);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}
</style>
