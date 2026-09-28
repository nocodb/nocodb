<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { DOMSerializer } from '@tiptap/pm/model'
import type { DocAiImproveMode, VariableDefinition } from 'nocodb-sdk'
import { useWorkflowEmailAi, useWorkflowEmailAiSuggestions } from '#imports'
import { expressionSpansToTokens } from '~/helpers/workflowExpressionHtml'

/**
 * "Write with AI" popover for the email body, opened from the toolbar and the selection bubble.
 * An empty body shows its own inline prompt instead (WorkflowInputAiEmptyState), so this menu is
 * disabled while that one is on screen — one prompt surface at a time.
 */
interface Props {
  editor: Editor
  variables?: VariableDefinition[]
  /** The body owns the prompt (empty-state) — the trigger focuses that instead of opening this menu. */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), { variables: () => [], disabled: false })

const emits = defineEmits<{
  (e: 'result', payload: { html: string; mode: 'write' | 'rewrite' }): void
}>()

const { $e } = useNuxtApp()

// Failures render inline below the prompt instead of as a toast, matching the empty state.
const { loading, error: aiError, aiWrite, aiRewrite, abort } = useWorkflowEmailAi({ toast: false })

const { suggestions, suggestLoading, aiVariables, loadSuggestions } = useWorkflowEmailAiSuggestions(toRef(props, 'variables'))

const open = ref(false)

const instruction = ref('')

const inputRef = ref<HTMLTextAreaElement>()

const hasSelection = computed(() => !props.editor.state.selection.empty)

const rewriteModes: { mode: DocAiImproveMode; label: string }[] = [
  { mode: 'writing', label: 'labels.docAiImproveWriting' },
  { mode: 'grammar', label: 'labels.docAiFixGrammar' },
  { mode: 'shorter', label: 'labels.docAiMakeShorter' },
  { mode: 'longer', label: 'labels.docAiMakeLonger' },
]

const toneModes: { mode: DocAiImproveMode; label: string }[] = [
  { mode: 'professional', label: 'labels.aiToneProfessional' },
  { mode: 'friendly', label: 'labels.aiToneFriendly' },
  { mode: 'casual', label: 'labels.aiToneCasual' },
  { mode: 'confident', label: 'labels.aiToneConfident' },
]

watch(open, (isOpen) => {
  if (isOpen) {
    focusInput()
    // Chips only show without a selection; don't bill a suggestion call that is never rendered.
    if (!hasSelection.value) loadSuggestions()
  } else {
    abort()
  }
})

// Escape must not depend on where focus ended up: the popup is portaled out of the compose
// modal's subtree, so a keystroke that misses the textarea closes the whole modal. Capture
// phase runs before the modal's own handler.
useEventListener(
  document,
  'keydown',
  (event: KeyboardEvent) => {
    if (!open.value || event.key !== 'Escape') return

    event.stopPropagation()
    event.preventDefault()
    open.value = false

    // Focus was inside the portaled popup, which sits outside the modal's subtree — leaving it
    // to fall to <body> means the modal never sees the next Escape and cannot be closed.
    nextTick(() => props.editor.commands.focus())
  },
  { capture: true },
)

// The popup is mounted lazily and animates in, so an immediate focus() lands while an ancestor
// is still display:none and the browser drops it. Retry across frames until it sticks.
function focusInput(attempt = 0) {
  const el = inputRef.value

  if (el) {
    el.focus()
    if (document.activeElement === el) return
  }

  if (attempt < 10) requestAnimationFrame(() => focusInput(attempt + 1))
}

// Editor HTML is sent with variable chips as their {{ }} tokens, so the model sees (and
// preserves) the real expression rather than a display label.
function selectionAsHtml(): string {
  const { from, to } = props.editor.state.selection
  const slice = props.editor.state.doc.slice(from, to)
  const container = document.createElement('div')
  container.appendChild(DOMSerializer.fromSchema(props.editor.schema).serializeFragment(slice.content))
  return expressionSpansToTokens(container.innerHTML)
}

function bodyAsHtml(): string {
  return props.editor.isEmpty ? '' : expressionSpansToTokens(props.editor.getHTML())
}

async function runWrite() {
  const text = instruction.value.trim()
  if (!text || loading.value) return
  const html = await aiWrite({ instruction: text, currentBody: bodyAsHtml(), variables: aiVariables.value })
  if (!html) return
  $e('a:workflow:email:ai:write')
  emits('result', { html, mode: 'write' })
  instruction.value = ''
  open.value = false
}

async function runRewrite(mode: DocAiImproveMode) {
  if (loading.value || props.editor.state.selection.empty) return
  const html = await aiRewrite({ html: selectionAsHtml(), mode, variables: aiVariables.value })
  if (!html) return
  $e('a:workflow:email:ai:rewrite', { mode })
  emits('result', { html, mode: 'rewrite' })
  open.value = false
}
</script>

<template>
  <NcDropdown v-model:visible="open" placement="bottomRight" :disabled="disabled" :overlay-style="{ zIndex: 10002 }">
    <slot :open="open" :loading="loading" :toggle="() => (open = !open)" />

    <template #overlay>
      <div class="nc-email-ai-menu" tabindex="-1" @mousedown.stop @click.stop>
        <div class="nc-email-ai-title">
          <GeneralIcon icon="ncAutoAwesome" class="w-3.5 h-3.5 text-nc-content-purple-dark" />
          {{ $t('labels.writeWithAi') }}
        </div>
        <textarea
          ref="inputRef"
          v-model="instruction"
          class="nc-email-ai-input"
          rows="3"
          :placeholder="$t('placeholder.describeEmail')"
          data-testid="nc-workflow-richtext-ai-input"
          @keydown.enter.exact.prevent="runWrite"
        />
        <NcAlert v-if="aiError" type="error" :message="aiError" />
        <div class="text-tiny text-nc-content-gray-muted">{{ $t('labels.aiEnterHint') }}</div>
        <div v-if="!hasSelection" class="flex flex-wrap gap-1" :class="{ 'is-loading': suggestLoading }">
          <button
            v-for="(s, i) in suggestions"
            :key="i"
            class="nc-email-ai-chip"
            :disabled="loading || suggestLoading"
            @click="instruction = s.prompt"
          >
            {{ s.label }}
          </button>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span v-if="aiVariables.length" class="text-tiny text-nc-content-gray-muted">
            {{ $t('labels.aiVariableCount', { count: aiVariables.length }, aiVariables.length) }}
          </span>
          <span v-else />
          <NcButton
            size="xs"
            type="primary"
            theme="ai"
            :disabled="!instruction.trim() || loading"
            :loading="loading"
            data-testid="nc-workflow-richtext-ai-generate"
            @click="runWrite"
          >
            <span class="inline-flex items-center gap-1.5">
              <GeneralIcon v-if="!loading" icon="ncAutoAwesome" class="w-3.5 h-3.5" />
              {{ $t('general.generate') }}
            </span>
          </NcButton>
        </div>

        <template v-if="hasSelection">
          <div class="nc-email-ai-divider" />
          <div class="nc-email-ai-section">{{ $t('labels.rewriteSelection') }}</div>
          <button
            v-for="m in rewriteModes"
            :key="m.mode"
            class="nc-email-ai-item"
            :disabled="loading"
            @click="runRewrite(m.mode)"
          >
            {{ $t(m.label) }}
          </button>
          <div class="nc-email-ai-section">{{ $t('labels.aiTone') }}</div>
          <div class="flex flex-wrap gap-1 px-1 pb-1">
            <button v-for="m in toneModes" :key="m.mode" class="nc-email-ai-chip" :disabled="loading" @click="runRewrite(m.mode)">
              {{ $t(m.label) }}
            </button>
          </div>
        </template>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
// Overlay renders in body, so this stays unscoped.
.nc-email-ai-menu {
  // Border, radius and shadow come from NcDropdown's overlay wrapper — repeating them here
  // draws a second, concentric border around the menu. Radius is kept so the background
  // corners follow the wrapper's.
  @apply flex flex-col gap-2 p-3 rounded-lg bg-nc-bg-default;
  width: 320px;

  .nc-email-ai-title {
    @apply flex items-center gap-1.5 text-small font-semibold text-nc-content-gray;
  }

  .nc-email-ai-input {
    @apply w-full px-2.5 py-2 text-small rounded-md border-1 border-nc-border-gray-medium outline-none resize-none;
    line-height: 1.5;

    // Purple focus, matching the body's AI prompt box.
    &:focus {
      border-color: var(--nc-border-coloured-purple);
      box-shadow: 0 0 0 2px var(--nc-bg-coloured-purple);
    }
  }

  .nc-email-ai-divider {
    @apply h-px bg-nc-border-gray-light my-1;
  }

  .nc-email-ai-section {
    @apply text-tiny font-semibold uppercase text-nc-content-gray-muted px-1;
    letter-spacing: 0.04em;
  }

  .nc-email-ai-item {
    @apply flex items-center h-7.5 px-2 rounded-md cursor-pointer text-left bg-transparent border-0 text-nc-content-gray;
    font-size: 13px;

    &:hover {
      @apply bg-nc-bg-gray-light;
    }

    &:disabled {
      @apply opacity-50 cursor-default;
    }
  }

  .is-loading .nc-email-ai-chip {
    @apply opacity-60;
  }

  .nc-email-ai-chip {
    @apply h-6.5 px-2 rounded-md cursor-pointer text-nc-content-gray-subtle;
    @apply border-1 border-nc-border-gray-medium bg-nc-bg-default;
    font-size: 12px;

    &:hover {
      @apply border-nc-border-brand bg-nc-bg-brand text-nc-content-brand;
    }
  }
}
</style>
