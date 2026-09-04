import type { VariableDefinition } from 'nocodb-sdk'
import type { WorkflowEmailAiSuggestion, WorkflowEmailAiVariable } from '#imports'
import { useWorkflowEmailAi } from '#imports'

/**
 * Suggestion chips for the AI email prompt: static ideas immediately, replaced by
 * model-generated ones (from the node's trigger + fields) once they arrive. Also owns the
 * variable flattening the prompt endpoints expect.
 */
export function useWorkflowEmailAiSuggestions(variables: Ref<VariableDefinition[]> | ComputedRef<VariableDefinition[]>) {
  const { t } = useI18n()

  const { aiSuggest, suggestLoading } = useWorkflowEmailAi()

  const staticSuggestions = computed<WorkflowEmailAiSuggestion[]>(() => [
    { label: t('labels.aiSuggestionOrderConfirmation'), prompt: t('labels.aiSuggestionOrderConfirmationPrompt') },
    { label: t('labels.aiSuggestionShippingUpdate'), prompt: t('labels.aiSuggestionShippingUpdatePrompt') },
    { label: t('labels.aiSuggestionPaymentReceipt'), prompt: t('labels.aiSuggestionPaymentReceiptPrompt') },
  ])

  const generated = ref<WorkflowEmailAiSuggestion[]>()

  const suggestions = computed(() => generated.value ?? staticSuggestions.value)

  // Flatten the upstream variable tree into leaf keys (what the prompts list), capped for prompt size.
  const aiVariables = computed<WorkflowEmailAiVariable[]>(() => {
    const out: WorkflowEmailAiVariable[] = []
    const walk = (vars: any[], prefix = '') => {
      for (const v of vars || []) {
        const name = prefix ? `${prefix} › ${v.name}` : v.name
        if (v.children?.length) walk(v.children, name)
        else if (v.key && !String(v.key).includes('.map(')) out.push({ key: v.key, name, type: v.type })
      }
    }
    walk(unref(variables))
    return out.slice(0, 60)
  })

  const triggerTitle = computed(() => (unref(variables)?.[0] as any)?.extra?.sourceNodeTitle as string | undefined)

  async function loadSuggestions() {
    const list = await aiSuggest({ triggerTitle: triggerTitle.value, variables: aiVariables.value })
    if (list?.length) generated.value = list
  }

  return { suggestions, suggestLoading, aiVariables, triggerTitle, loadSuggestions }
}
