<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { DOMSerializer } from '@tiptap/pm/model'
import type { DocAiImproveMode, VariableDefinition } from 'nocodb-sdk'
import { useWorkflowEmailAi } from '#imports'

/**
 * "Write with AI" popover for the email body. The trigger is slotted so the toolbar button
 * and the empty-body call-to-action share one menu and one request pipeline.
 */
interface Props {
  editor: Editor
  variables?: VariableDefinition[]
  placement?: 'bottomLeft' | 'bottomRight' | 'topLeft'
}

const props = withDefaults(defineProps<Props>(), { variables: () => [], placement: 'bottomLeft' })

const emits = defineEmits<{
  (e: 'result', payload: { html: string; mode: 'write' | 'rewrite' }): void
}>()

const { $e } = useNuxtApp()

const { loading, aiWrite, aiRewrite, abort } = useWorkflowEmailAi()

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

const toneModes: DocAiImproveMode[] = ['professional', 'friendly', 'casual', 'confident']

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

watch(open, (isOpen) => {
  if (isOpen) nextTick(() => inputRef.value?.focus())
  else abort()
})

// Selected content as HTML, with variable chips sent as their {{ }} tokens so the model
// sees (and preserves) the real expression rather than a display label.
function selectionAsHtml(): string {
  const { from, to } = props.editor.state.selection
  const slice = props.editor.state.doc.slice(from, to)
  const container = document.createElement('div')
  container.appendChild(DOMSerializer.fromSchema(props.editor.schema).serializeFragment(slice.content))
  container.querySelectorAll('span[data-type="workflowExpression"]').forEach((el) => {
    el.replaceWith(document.createTextNode(el.getAttribute('data-expression') || ''))
  })
  return container.innerHTML
}

async function runWrite() {
  const text = instruction.value.trim()
  if (!text || loading.value) return
  $e('a:workflow:email:ai:write')
  const html = await aiWrite({
    instruction: text,
    currentBody: props.editor.isEmpty ? '' : props.editor.getHTML(),
    variables: aiVariables.value,
  })
  if (!html) return
  emits('result', { html, mode: 'write' })
  instruction.value = ''
  open.value = false
}

async function runRewrite(mode: DocAiImproveMode) {
  if (loading.value || props.editor.state.selection.empty) return
  $e('a:workflow:email:ai:rewrite', { mode })
  const html = await aiRewrite({ html: selectionAsHtml(), mode, variables: aiVariables.value })
  if (!html) return
  emits('result', { html, mode: 'rewrite' })
  open.value = false
}
</script>

<template>
  <NcDropdown v-model:visible="open" :placement="placement" :overlay-style="{ zIndex: 10002 }">
    <slot :open="open" :loading="loading" :toggle="() => (open = !open)" />

    <template #overlay>
      <div class="nc-email-ai-menu" @mousedown.stop @click.stop>
        <div class="nc-email-ai-title">
          <GeneralIcon icon="ncAutoAwesome" class="w-3.5 h-3.5 text-nc-content-brand" />
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
          @keydown.esc.stop.prevent="open = false"
        />
        <div class="flex items-center justify-between gap-2">
          <span v-if="aiVariables.length" class="text-tiny text-nc-content-gray-muted">
            {{ aiVariables.length }} {{ $t('general.variables').toLowerCase() }}
          </span>
          <span v-else />
          <NcButton
            size="xs"
            type="primary"
            :disabled="!instruction.trim() || loading"
            :loading="loading"
            data-testid="nc-workflow-richtext-ai-generate"
            @click="runWrite"
          >
            {{ $t('general.generate') }}
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
            <button v-for="m in toneModes" :key="m" class="nc-email-ai-chip" :disabled="loading" @click="runRewrite(m)">
              {{ m }}
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
  @apply flex flex-col gap-2 p-3 rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium;
  width: 320px;
  box-shadow: 0 8px 24px rgba(16, 16, 21, 0.12);

  .nc-email-ai-title {
    @apply flex items-center gap-1.5 text-small font-semibold text-nc-content-gray;
  }

  .nc-email-ai-input {
    @apply w-full px-2.5 py-2 text-small rounded-md border-1 border-nc-border-gray-medium outline-none resize-none;
    @apply focus:border-nc-border-brand;
    line-height: 1.5;
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

  .nc-email-ai-chip {
    @apply h-6.5 px-2 rounded-md cursor-pointer capitalize text-nc-content-gray-subtle;
    @apply border-1 border-nc-border-gray-medium bg-nc-bg-default;
    font-size: 12px;

    &:hover {
      @apply border-nc-border-brand bg-nc-bg-brand text-nc-content-brand;
    }
  }
}
</style>
