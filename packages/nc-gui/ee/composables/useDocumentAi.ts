/**
 * Composable for document AI operations.
 *
 * Calls the `/api/v2/ai/bases/:baseId/docs` endpoint with operation-specific payloads.
 * Wraps loading/error state from useNocoAi and adds doc-specific methods.
 */
export const useDocumentAi = createSharedComposable(() => {
  const { $api, $e } = useNuxtApp()

  const basesStore = useBases()

  const { activeProjectId } = storeToRefs(basesStore)

  const { aiIntegrationAvailable, aiError } = useNocoAi()

  const docAiLoading = ref(false)

  let activeAbortController: AbortController | null = null

  const abortCurrentRequest = () => {
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }
  }

  const callDocAiApi = async (operation: string, input: any, customBaseId?: string) => {
    try {
      const baseId = customBaseId || activeProjectId.value

      if (!aiIntegrationAvailable.value || !baseId) {
        return
      }

      // Abort any in-flight request before starting a new one
      abortCurrentRequest()
      const controller = new AbortController()
      activeAbortController = controller

      docAiLoading.value = true
      aiError.value = ''

      const res = await $api.instance
        .post(`/api/v2/ai/bases/${baseId}/docs`, { operation, input }, { signal: controller.signal })
        .then((r: any) => r.data)

      return res
    } catch (e: any) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') {
        // Request was aborted — silently ignore
        return
      }
      const error = await extractSdkResponseErrorMsg(e)
      aiError.value = error
      message.warning(error || 'AI is busy. Please try again.')
    } finally {
      activeAbortController = null
      docAiLoading.value = false
    }
  }

  const aiWrite = async (instruction: string, context?: string, title?: string) => {
    const res = await callDocAiApi('docAiWrite', { instruction, context, title })
    if (res?.text) $e('a:doc:ai:write')
    return res?.text as string | undefined
  }

  const aiContinue = async (precedingContent: string, title?: string) => {
    const res = await callDocAiApi('docAiContinue', { precedingContent, title })
    if (res?.text) $e('a:doc:ai:continue')
    return res?.text as string | undefined
  }

  const aiImprove = async (text: string, mode: string) => {
    const res = await callDocAiApi('docAiImprove', { text, mode })
    if (res?.text) $e('a:doc:ai:improve', { mode })
    return res?.text as string | undefined
  }

  const aiSummarize = async (text: string) => {
    const res = await callDocAiApi('docAiSummarize', { text })
    if (res?.text) $e('a:doc:ai:summarize')
    return res?.text as string | undefined
  }

  const aiTranslate = async (text: string, targetLanguage: string) => {
    const res = await callDocAiApi('docAiTranslate', { text, targetLanguage })
    if (res?.text) $e('a:doc:ai:translate', { targetLanguage })
    return res?.text as string | undefined
  }

  return {
    docAiLoading,
    aiWrite,
    aiContinue,
    aiImprove,
    aiSummarize,
    aiTranslate,
    abortCurrentRequest,
  }
})
