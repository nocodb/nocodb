/**
 * Composable for document AI operations.
 *
 * Calls the `/api/v2/ai/bases/:baseId/docs` endpoint with operation-specific payloads.
 * Wraps loading/error state from useNocoAi and adds doc-specific methods.
 */
export const useDocumentAi = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const basesStore = useBases()

  const { activeProjectId } = storeToRefs(basesStore)

  const { aiIntegrationAvailable, aiError } = useNocoAi()

  const docAiLoading = ref(false)

  const callDocAiApi = async (operation: string, input: any, customBaseId?: string) => {
    try {
      const baseId = customBaseId || activeProjectId.value

      if (!aiIntegrationAvailable.value || !baseId) {
        return
      }

      docAiLoading.value = true
      aiError.value = ''

      const res = await $api.instance.post(`/api/v2/ai/bases/${baseId}/docs`, { operation, input }).then((r: any) => r.data)

      return res
    } catch (e: any) {
      const error = await extractSdkResponseErrorMsg(e)
      aiError.value = error
      message.warning(error || 'AI is busy. Please try again.')
    } finally {
      docAiLoading.value = false
    }
  }

  const aiWrite = async (instruction: string, context?: string, title?: string) => {
    const res = await callDocAiApi('docAiWrite', { instruction, context, title })
    return res?.text as string | undefined
  }

  const aiContinue = async (precedingContent: string, title?: string) => {
    const res = await callDocAiApi('docAiContinue', { precedingContent, title })
    return res?.text as string | undefined
  }

  const aiImprove = async (text: string, mode: string) => {
    const res = await callDocAiApi('docAiImprove', { text, mode })
    return res?.text as string | undefined
  }

  const aiSummarize = async (text: string) => {
    const res = await callDocAiApi('docAiSummarize', { text })
    return res?.text as string | undefined
  }

  const aiTranslate = async (text: string, targetLanguage: string) => {
    const res = await callDocAiApi('docAiTranslate', { text, targetLanguage })
    return res?.text as string | undefined
  }

  return {
    docAiLoading,
    aiWrite,
    aiContinue,
    aiImprove,
    aiSummarize,
    aiTranslate,
  }
})
