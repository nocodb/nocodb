import type { DocAiImproveMode } from 'nocodb-sdk'

export interface WorkflowEmailAiVariable {
  key: string
  name: string
  type?: string
}

export interface WorkflowEmailAiSuggestion {
  label: string
  prompt: string
}

// CE has no AI; the EE overlay (ee/composables/useWorkflowEmailAi.ts) provides the real thing.
export const useWorkflowEmailAi = () => ({
  available: computed(() => false),
  loading: ref(false),
  aiWrite: async (_input: {
    instruction: string
    subject?: string
    currentBody?: string
    variables?: WorkflowEmailAiVariable[]
  }): Promise<string | undefined> => undefined,
  aiRewrite: async (_input: {
    html: string
    mode: DocAiImproveMode
    variables?: WorkflowEmailAiVariable[]
  }): Promise<string | undefined> => undefined,
  aiSuggest: async (_input: {
    triggerTitle?: string
    subject?: string
    variables?: WorkflowEmailAiVariable[]
  }): Promise<WorkflowEmailAiSuggestion[] | undefined> => undefined,
  suggestLoading: ref(false),
  abort: () => {},
})
