<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import type { VariableDefinition } from 'nocodb-sdk'
import { useWorkflowEmailAi } from '#imports'

/**
 * Empty-body state for the email editor: a card offering "Write with AI" or "Start blank",
 * swapping in place for an inline prompt box. Replaces the placeholder while the body is empty.
 */
interface Props {
  editor: Editor
  variables?: VariableDefinition[]
}

const props = withDefaults(defineProps<Props>(), { variables: () => [] })

const emits = defineEmits<{
  (e: 'result', payload: { html: string; mode: 'write' }): void
  (e: 'startBlank'): void
}>()

const { $e } = useNuxtApp()

const { t } = useI18n()

const { loading, aiWrite, abort } = useWorkflowEmailAi()

const promptOpen = ref(false)

const prompt = ref('')

const error = ref('')

const inputRef = ref<HTMLTextAreaElement>()

const suggestions = [
  { label: 'labels.aiSuggestionOrderConfirmation', prompt: 'labels.aiSuggestionOrderConfirmationPrompt' },
  { label: 'labels.aiSuggestionShippingUpdate', prompt: 'labels.aiSuggestionShippingUpdatePrompt' },
  { label: 'labels.aiSuggestionPaymentReceipt', prompt: 'labels.aiSuggestionPaymentReceiptPrompt' },
]

// "Or {startBlank} instead" — split around the link so the sentence stays translatable.
const orStartBlank = computed(() => {
  const [before, after] = t('labels.aiOrStartBlank').split('{startBlank}')
  return { before, after: after ?? '' }
})

// Flatten the upstream variable tree into what the prompt lists (leaf keys only).
const aiVariables = computed(() => {
  const out: { key: string; name: string; type?: string }[] = []
  const walk = (vars: any[], prefix = '') => {
    for (const v of vars || []) {
      const name = prefix ? `${prefix} › ${v.name}` : v.name
      if (v.children?.length) walk(v.children, name)
      else if (v.key && !String(v.key).includes('.map(')) out.push({ key: v.key, name, type: v.type })
    }
  }
  walk(props.variables)
  return out.slice(0, 60)
})

function openPrompt() {
  error.value = ''
  promptOpen.value = true
  nextTick(() => inputRef.value?.focus())
}

function closePrompt() {
  abort()
  promptOpen.value = false
}

function useSuggestion(key: string) {
  prompt.value = t(key)
  inputRef.value?.focus()
}

function autoGrow() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

async function generate() {
  const instruction = prompt.value.trim()
  if (!instruction || loading.value) return
  error.value = ''
  $e('a:workflow:email:ai:write', { source: 'empty-state' })
  const html = await aiWrite({ instruction, variables: aiVariables.value })
  if (!html) {
    error.value = t('msg.error.somethingWentWrongTryAgain')
    return
  }
  emits('result', { html, mode: 'write' })
}
</script>

<template>
  <div class="nc-email-ai-empty" :class="{ 'is-prompt': promptOpen }" data-testid="nc-workflow-richtext-ai-empty">
    <!-- State A: resting -->
    <div v-if="!promptOpen" class="nc-email-ai-empty-card">
      <div class="nc-email-ai-empty-tile">
        <GeneralIcon icon="lucideSparkles" class="w-5 h-5" />
      </div>
      <div class="nc-email-ai-empty-title">{{ $t('labels.aiEmptyTitle') }}</div>
      <div class="nc-email-ai-empty-desc">{{ $t('labels.aiEmptyDescription') }}</div>
      <div class="flex items-center gap-2 mt-2.5">
        <NcButton size="small" type="primary" theme="ai" data-testid="nc-workflow-richtext-ai-empty-write" @click="openPrompt">
          <span class="inline-flex items-center gap-1.5">
            <GeneralIcon icon="lucideSparkles" class="w-4 h-4" />
            {{ $t('labels.writeWithAi') }}
          </span>
        </NcButton>
        <NcButton size="small" type="text" data-testid="nc-workflow-richtext-ai-empty-blank" @click="emits('startBlank')">
          {{ $t('labels.startBlank') }}
        </NcButton>
      </div>
    </div>

    <!-- State B: prompt open -->
    <template v-else>
      <div class="nc-email-ai-prompt">
        <div class="flex items-start gap-2.5 flex-1">
          <GeneralIcon icon="lucideSparkles" class="w-4 h-4 flex-none mt-0.5 text-nc-content-purple-dark" />
          <textarea
            ref="inputRef"
            v-model="prompt"
            class="nc-email-ai-prompt-input"
            rows="3"
            :placeholder="$t('placeholder.describeEmail')"
            :disabled="loading"
            data-testid="nc-workflow-richtext-ai-empty-input"
            @input="autoGrow"
            @keydown.enter.exact.prevent="generate"
            @keydown.esc.stop.prevent="closePrompt"
          />
        </div>
        <NcAlert v-if="error" type="error" :message="error" class="!mt-1" />
        <div class="flex items-center justify-end gap-2">
          <span class="text-tiny text-nc-content-gray-muted">{{ $t('labels.aiShiftEnterHint') }}</span>
          <NcButton
            size="xs"
            type="primary"
            theme="ai"
            :disabled="!prompt.trim() || loading"
            :loading="loading"
            data-testid="nc-workflow-richtext-ai-empty-generate"
            @click="generate"
          >
            <span class="inline-flex items-center gap-1.5">
              <GeneralIcon v-if="!loading" icon="lucideSparkles" class="w-3.5 h-3.5" />
              {{ $t('general.generate') }}
            </span>
          </NcButton>
        </div>
      </div>

      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="s in suggestions"
          :key="s.label"
          class="nc-email-ai-chip"
          :disabled="loading"
          @click="useSuggestion(s.prompt)"
        >
          {{ $t(s.label) }}
        </button>
      </div>

      <div class="nc-email-ai-empty-escape">
        {{ orStartBlank.before
        }}<span class="nc-email-ai-empty-link" @click="emits('startBlank')">{{ $t('labels.startBlank').toLowerCase() }}</span
        >{{ orStartBlank.after }}
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-email-ai-empty {
  @apply flex items-center justify-center p-4 h-full min-h-65;

  &.is-prompt {
    @apply flex-col items-stretch justify-start gap-3;
  }
}

.nc-email-ai-empty-card {
  @apply flex flex-col items-center gap-1.5 text-center;
  max-width: 320px;
}

.nc-email-ai-empty-tile {
  @apply flex items-center justify-center w-10 h-10 mb-1.5 text-nc-content-purple-dark;
  border-radius: 10px;
  background: var(--nc-bg-coloured-purple);
}

.nc-email-ai-empty-title {
  @apply text-sm font-bold text-nc-content-gray;
}

.nc-email-ai-empty-desc {
  @apply text-nc-content-gray-subtle;
  font-size: 13px;
  line-height: 20px;
  text-wrap: pretty;
}

.nc-email-ai-prompt {
  @apply flex flex-col gap-2 rounded-lg bg-nc-bg-default;
  min-height: 112px;
  padding: 10px 10px 8px 12px;
  border: 1px solid var(--nc-border-coloured-purple);
  box-shadow: 0 0 0 2px var(--nc-bg-coloured-purple);
}

.nc-email-ai-prompt-input {
  @apply flex-1 w-full bg-transparent border-0 outline-none resize-none p-0 text-sm text-nc-content-gray;
  line-height: 20px;
  min-height: 60px;

  &::placeholder {
    @apply text-nc-content-gray-muted;
  }
}

.nc-email-ai-chip {
  @apply rounded-md cursor-pointer text-nc-content-gray-subtle bg-nc-bg-default border-1 border-nc-border-gray-medium;
  font-size: 12px;
  padding: 4px 10px;

  &:hover {
    @apply bg-nc-bg-gray-light;
  }

  &:disabled {
    @apply opacity-50 cursor-default;
  }
}

.nc-email-ai-empty-escape {
  @apply text-nc-content-gray-muted mt-1;
  font-size: 13px;
}

.nc-email-ai-empty-link {
  @apply text-nc-content-brand font-semibold cursor-pointer;
}
</style>
