<script lang="ts" setup>
/**
 * AiFilterPrompt.vue — EE-only component
 *
 * Renders an always-visible AI prompt input at the top of the filter panel.
 * Users type a natural-language description (e.g. "Title is either a or b"),
 * which is sent to the backend predictFilters AI operation. The AI returns
 * structured filter conditions that are emitted to the parent (ColumnFilterMenu)
 * for insertion into the filter list.
 *
 * Visibility: only shown when EE UI is active, AI features are enabled,
 * and an AI integration is configured in the workspace.
 */
const props = defineProps<{
  isParentOpen: boolean
}>()

const emit = defineEmits<{
  applyFilters: [
    payload: {
      action: 'add' | 'replace' | 'clear'
      filters: {
        column: string
        comparison_op: string
        comparison_sub_op: string | null
        value: string | null
        logical_op: string
      }[]
    },
  ]
}>()

const { isParentOpen } = toRefs(props)

const { $e } = useNuxtApp()

const { t } = useI18n()

const { predictFilters, aiIntegrationAvailable, isAiFeaturesEnabled } = useNocoAi()

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const { activeTable } = storeToRefs(useTablesStore())

const { activeProjectId } = storeToRefs(useBases())

const prompt = ref('')

const aiFilterInputRef = ref<HTMLInputElement>()

// Auto-focus the AI filter input when the parent dropdown opens.
// Follows the same pattern as NcList's focusInputBox (used by sort/group-by menus).
//
// Two triggers are needed:
// 1. watch(isParentOpen) — handles re-opens (component stays mounted after first open)
// 2. onMounted — handles the first open after page reload, because the component
//    mounts *after* isParentOpen is already true (the watch doesn't fire for the initial value)
const focusInput = () => {
  setTimeout(() => {
    aiFilterInputRef.value?.focus()
  }, 100)
}

watch(isParentOpen, (isOpen) => {
  if (isOpen) {
    focusInput()
  }
})

onMounted(() => {
  if (isParentOpen.value) {
    focusInput()
  }
})

const isLoading = ref(false)

// Only render the AI prompt when all prerequisites are met
const isVisible = computed(() => {
  return isEeUI && isAiFeaturesEnabled.value && aiIntegrationAvailable.value
})

const handleSubmit = async () => {
  const description = prompt.value?.trim()
  if (!description || isLoading.value) return

  const tableId = activeTable.value?.id || meta.value?.id
  if (!tableId) return

  isLoading.value = true

  // Telemetry: track that the user submitted an AI filter prompt
  $e('a:filter:ai:predict', { action: 'submit' })

  try {
    // Call the backend AI predictFilters operation via useNocoAi composable.
    // Returns { action, filters } where action is 'add', 'replace', or 'clear'.
    const result = await predictFilters(
      tableId,
      description,
      activeView.value?.id,
      activeProjectId.value,
      false, // skipMsgToast — show errors to user
    )

    // For 'clear' action, emit even with empty filters array so the handler can delete existing ones.
    // For 'replace', emit even if filters are empty — caller needs to clear existing filters first.
    // For 'add', only emit if there are actual filters to append.
    if (result.action === 'clear' || result.action === 'replace' || result.filters?.length) {
      // Telemetry: track successful AI filter application with action type and filter count
      $e('a:filter:ai:apply', {
        action: result.action,
        filterCount: result.filters?.length || 0,
      })

      emit('applyFilters', result)
      prompt.value = ''
    } else {
      // Telemetry: AI returned no usable filters for the given description
      $e('a:filter:ai:empty-result')
      message.info(t('title.aiFilterNoResults'))
    }
  } catch (e: any) {
    // Telemetry: track AI filter prediction failure
    $e('a:filter:ai:error')
    // Note: API-level errors (e.g. AI integration not found, rate limits) are already
    // shown to the user as toast messages by useNocoAi's callAiSchemaApi (skipMsgToast=false).
    // This catch handles unexpected errors only.
  } finally {
    isLoading.value = false
  }
}

// Submit on Enter, but allow Shift+Enter for future multi-line support
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    e.stopPropagation()
    handleSubmit()
  }
}
</script>

<template>
  <div v-if="isVisible" class="nc-ai-filter-prompt px-2 pt-2 pb-1">
    <div class="nc-ai-filter-input-wrapper">
      <GeneralIcon icon="ncAutoAwesome" class="nc-ai-filter-sparkle-icon" />
      <input
        ref="aiFilterInputRef"
        v-model="prompt"
        class="nc-ai-filter-input"
        :placeholder="$t('title.aiFilterPlaceholder')"
        :disabled="isLoading"
        @keydown="handleKeydown"
      />
      <NcButton
        size="xxsmall"
        theme="ai"
        type="primary"
        class="!rounded-md"
        :disabled="!prompt?.trim() || isLoading"
        :loading="isLoading"
        @click="handleSubmit"
      >
        <GeneralIcon v-if="!isLoading" icon="ncArrowUp" class="h-3 w-3" />
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-ai-filter-prompt {
  border-bottom: 1px solid var(--nc-border-gray-medium);
}

// No border on the input wrapper — the parent's border-bottom divider is sufficient
.nc-ai-filter-input-wrapper {
  @apply flex items-center gap-1.5 px-2 py-1;
}

.nc-ai-filter-sparkle-icon {
  @apply flex-none h-4 w-4;
  color: var(--nc-content-purple-dark);
}

.nc-ai-filter-input {
  @apply flex-1 text-sm bg-transparent outline-none border-none;
  color: var(--nc-content-gray);
  min-width: 0;

  &::placeholder {
    color: var(--nc-content-gray-muted);
  }

  &:disabled {
    @apply opacity-60;
  }
}
</style>
