/**
 * CE stub for useSharedDoc. The real implementation lives in
 * ee/composables/useSharedDoc.ts — docs and doc-share are EE-only features.
 */
import type { PublicDocContentResponse, PublicDocMetaResponse } from 'nocodb-sdk'

export function useSharedDoc() {
  const meta = ref<PublicDocMetaResponse | null>(null)
  const activeContent = ref<PublicDocContentResponse | null>(null)
  const isLoading = ref(false)
  const notFound = ref(false)

  const loadMeta = async (..._args: any[]) => {}
  const loadDoc = async (..._args: any[]) => {}
  const loadChildren = async (..._args: any[]) => {}
  const fetchDocInfo = async (..._args: any[]) => null
  const isLoadingChildren = (..._args: any[]) => false
  const areChildrenLoaded = (..._args: any[]) => false

  return {
    meta,
    activeContent,
    isLoading,
    notFound,
    loadMeta,
    loadDoc,
    loadChildren,
    fetchDocInfo,
    isLoadingChildren,
    areChildrenLoaded,
  }
}
