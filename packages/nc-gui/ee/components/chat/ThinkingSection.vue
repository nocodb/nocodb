<script setup lang="ts">
import { ChatToolCallStatus } from 'nocodb-sdk'
import type { ThinkingStep, ToolUseBlock } from '~/ee/utils/chat/thinkingStepConfig'
import { STEP_CONFIG, extractMentions, extractSources, generateDescription } from '~/ee/utils/chat/thinkingStepConfig'
import { getUIDTIcon } from '~/utils/columnUtils'

interface Props {
  blocks: ToolUseBlock[]
  isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
})

const { blocks, isStreaming } = toRefs(props)

const chatStore = useChatStore()
const { agentLabel } = storeToRefs(chatStore)
const { t } = useI18n()

const thinkingLabel = computed(() => agentLabel.value || t('msg.chat.thinking'))

const isExpanded = ref(false)

// Auto-expand while streaming, collapse when done
watch(
  isStreaming,
  (streaming) => {
    isExpanded.value = streaming
  },
  { immediate: true },
)

const steps = computed<ThinkingStep[]>(() => {
  const result: ThinkingStep[] = []

  for (const block of blocks.value) {
    if (block.status === ChatToolCallStatus.ERROR || block.is_error) continue

    const config = STEP_CONFIG[block.name]
    const lastStep = result[result.length - 1]

    // Group same-name consecutive tools
    if (lastStep && lastStep.blocks[0]?.name === block.name) {
      lastStep.blocks.push(block)
      if (config) lastStep.label = config.labelFn(lastStep.blocks)
      const mentions = extractMentions(lastStep.blocks)
      lastStep.tableName = mentions.tableName
      lastStep.fieldBadges = mentions.fieldBadges
      lastStep.sources = extractSources(lastStep.blocks)
      lastStep.isRunning = lastStep.blocks.some(
        (b) => b.status === ChatToolCallStatus.RUNNING || b.status === ChatToolCallStatus.PENDING,
      )
      lastStep.isComplete = lastStep.blocks.every((b) => b.status === ChatToolCallStatus.SUCCESS)
    } else {
      const isRunning = block.status === ChatToolCallStatus.RUNNING || block.status === ChatToolCallStatus.PENDING
      const mentions = extractMentions([block])

      result.push({
        category: config?.category || 'other',
        icon: config?.icon || 'ncSettings2',
        label: config ? config.labelFn([block]) : block.name.replace(/_/g, ' '),
        description: generateDescription(block),
        tableName: mentions.tableName,
        fieldBadges: mentions.fieldBadges,
        sources: extractSources([block]),
        blocks: [block],
        isRunning,
        isComplete: block.status === ChatToolCallStatus.SUCCESS,
      })
    }
  }

  return result
})
</script>

<template>
  <div v-if="steps.length > 0" class="nc-chat-thinking">
    <!-- Streaming header: live "Thinking..." label -->
    <div v-if="isStreaming" class="nc-thinking-live-header">
      <span class="nc-thinking-live-dot" />
      <span class="nc-thinking-live-text">{{ thinkingLabel }}</span>
    </div>

    <!-- Static toggle header: shown after streaming stops -->
    <button v-else class="nc-thinking-toggle" @click="isExpanded = !isExpanded">
      <span class="nc-thinking-toggle-text">
        {{ isExpanded ? $t('msg.chat.hideThinking') : $t('msg.chat.showThinking') }}
      </span>
      <GeneralIcon icon="chevronDown" class="nc-thinking-chevron" :class="{ 'nc-thinking-chevron--up': isExpanded }" />
    </button>

    <!-- Expandable steps -->
    <Transition name="nc-thinking-expand">
      <div v-if="isExpanded" class="nc-thinking-steps">
        <TransitionGroup name="nc-step-item" tag="div" class="nc-thinking-steps-inner">
          <div v-for="(step, si) in steps" :key="si" class="nc-thinking-step" :style="{ '--step-delay': `${si * 40}ms` }">
            <!-- Icon -->
            <div class="nc-thinking-step-icon" :class="`nc-thinking-step-icon--${step.category}`">
              <span v-if="step.isRunning" class="nc-thinking-step-spinner" />
              <GeneralIcon v-else :icon="step.icon" class="w-3.5 h-3.5" />
            </div>

            <!-- Content -->
            <div class="nc-thinking-step-content">
              <!-- Title -->
              <span class="nc-thinking-step-title">{{ step.label }}</span>

              <!-- Description + badges block -->
              <div v-if="step.description || step.fieldBadges.length" class="nc-thinking-step-detail">
                <div v-if="step.description" class="nc-thinking-step-desc" v-html="step.description" />

                <!-- Badges -->
                <div v-if="step.fieldBadges.length" class="nc-thinking-step-badges">
                  <span v-for="badge in step.fieldBadges" :key="badge.name" class="nc-thinking-badge">
                    <component :is="getUIDTIcon(badge.uidt)" class="nc-thinking-badge-icon" />
                    {{ badge.name }}
                  </span>
                </div>
              </div>
              <div v-if="step.sources?.length" class="nc-thinking-step-sources">
                <ChatWebSourceChip v-for="(source, si) in step.sources" :key="source.url" :source="source" :index="si" />
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.nc-chat-thinking {
  @apply flex flex-col;
}

.nc-thinking-live-header {
  @apply flex items-center gap-2 py-0.5;
}

.nc-thinking-live-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--nc-content-brand);
  animation: nc-dot-pulse 2s ease-in-out infinite;
}

.nc-thinking-live-text {
  --base-color: var(--nc-content-brand);
  --shimmer-color: #a78bfa;

  font-size: 14px;
  font-weight: 600;
  color: transparent;
  background: linear-gradient(90deg, transparent 33%, var(--shimmer-color) 50%, transparent 67%) var(--base-color);
  background-size: 300% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  animation: nc-shimmer-slide 2s ease-in-out infinite;
}

@keyframes nc-shimmer-slide {
  0% {
    background-position: 100% center;
  }
  100% {
    background-position: -100% center;
  }
}

@keyframes nc-dot-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.75);
  }
}

.nc-thinking-toggle {
  @apply flex items-center gap-1.5
    cursor-pointer select-none
    text-bodySm
    py-0.5;

  &:hover {
    .nc-thinking-toggle-text {
      @apply text-nc-content-gray;
    }
  }
}

.nc-thinking-toggle-text {
  @apply text-nc-content-gray-subtle transition-colors duration-150;
}

.nc-thinking-chevron {
  @apply flex-none w-3 h-3 text-nc-content-gray-subtle transition-transform duration-200;

  &--up {
    transform: rotate(180deg);
  }
}

.nc-thinking-expand-enter-active,
.nc-thinking-expand-leave-active {
  transition: all 250ms ease;
  overflow: hidden;
}

.nc-thinking-expand-enter-from,
.nc-thinking-expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.nc-thinking-expand-enter-to,
.nc-thinking-expand-leave-from {
  opacity: 1;
  max-height: 1200px;
}

.nc-thinking-steps {
  @apply mt-2;
}

.nc-thinking-steps-inner {
  @apply flex flex-col gap-0.5;
}

.nc-thinking-step {
  @apply flex items-start gap-2.5 py-1;
}

.nc-thinking-step-icon {
  @apply flex-none flex items-center justify-center w-6 h-6 rounded-md mt-px;

  &--search {
    @apply bg-nc-bg-brand text-nc-content-brand;
  }

  &--create {
    @apply bg-nc-bg-green text-nc-content-green;
  }

  &--update {
    @apply bg-nc-bg-orange text-nc-content-orange;
  }

  &--delete {
    @apply bg-nc-bg-red text-nc-content-red;
  }

  &--link {
    @apply bg-nc-bg-purple text-nc-content-purple;
  }

  &--web,
  &--navigate,
  &--other {
    @apply bg-nc-bg-gray-light text-nc-content-gray-subtle;
  }
}

.nc-thinking-step-spinner {
  @apply w-3.5 h-3.5 rounded-full;
  border: 1.5px solid transparent;
  border-top-color: currentColor;
  border-right-color: currentColor;
  animation: nc-spin 0.7s linear infinite;
}

@keyframes nc-spin {
  to {
    transform: rotate(360deg);
  }
}

.nc-thinking-step-content {
  @apply flex-1 min-w-0 pt-0.5;
}

.nc-thinking-step-title {
  @apply text-bodySm font-semibold text-nc-content-gray;
}

.nc-thinking-step-detail {
  @apply mt-1 pl-3 border-l-2 border-nc-border-gray-medium;
}

.nc-thinking-step-desc {
  @apply text-captionSm text-nc-content-gray-subtle leading-5;
}

.nc-thinking-step-sources {
  @apply flex flex-wrap items-center gap-1 mt-1.5;
}

.nc-thinking-step-badges {
  @apply flex flex-wrap items-center gap-1.5 mt-1.5;
}

.nc-thinking-badge {
  @apply inline-flex items-center gap-1
    px-2 py-0.5
    rounded-full
    bg-nc-bg-gray-light
    text-nc-content-gray-subtle
    text-[11px] leading-4 font-medium;
}

.nc-thinking-badge-icon {
  @apply w-3 h-3 flex-none;
}

.nc-step-item-enter-active {
  transition: all 300ms ease;
  transition-delay: var(--step-delay, 0ms);
}

.nc-step-item-leave-active {
  transition: all 200ms ease;
}

.nc-step-item-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.nc-step-item-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.nc-step-item-move {
  transition: transform 250ms ease;
}
</style>
