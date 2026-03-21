/**
 * CE stub for document AI composable — all operations are no-ops.
 */
export const useDocumentAi = createSharedComposable(() => {
  const docAiLoading = ref(false)

  const aiWrite = async (_instruction: string, _context?: string, _title?: string): Promise<string | undefined> => undefined

  const aiContinue = async (_precedingContent: string, _title?: string): Promise<string | undefined> => undefined

  const aiImprove = async (_text: string, _mode: string): Promise<string | undefined> => undefined

  const aiSummarize = async (_text: string): Promise<string | undefined> => undefined

  const aiTranslate = async (_text: string, _targetLanguage: string): Promise<string | undefined> => undefined

  const abortCurrentRequest = () => {}

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
