/**
 * CE stub for useSharedDoc. The real implementation lives in
 * ee/composables/useSharedDoc.ts — docs and doc-share are EE-only features.
 */
import type { PublicDocContentResponse, PublicDocMetaResponse } from 'nocodb-sdk'

export function useSharedDoc() {
  const meta = ref<PublicDocMetaResponse | null>(null)
  const activeContent = ref<PublicDocContentResponse | null>(null)
  const isLoading = ref(false)
  const requiresPassword = ref(false)
  const password = ref<string | undefined>(undefined)

  const loadMeta = async (..._args: any[]) => {}
  const loadDoc = async (..._args: any[]) => {}
  const setPassword = (..._args: any[]) => {}

  return {
    meta,
    activeContent,
    isLoading,
    requiresPassword,
    password,
    loadMeta,
    loadDoc,
    setPassword,
  }
}
