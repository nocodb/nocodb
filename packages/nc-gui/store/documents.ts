export const useDocumentsStore = defineStore('documentsStore', () => {
  const documents = ref(new Map())

  const activeDocumentId = ref<string | null>(null)

  const isLoadingDocuments = ref(false)

  const activeDocuments = computed(() => [])

  const activeDocument = computed(() => null)

  const documentTree = computed(() => [])

  const expandedDocIds = ref(new Set<string>())

  const loadedParentIds = ref(new Set<string>())

  const loadingParentIds = ref(new Set<string>())

  const toggleCollapse = (..._params: any) => {}

  const isCollapsed = (..._params: any) => false

  const expandDocument = async (..._params: any) => {}

  const isLoadingChildren = (..._params: any) => false

  const setActiveDocumentId = (..._params: any) => {}

  const loadDocuments = async (..._params: any) => []

  const loadChildren = async (..._params: any) => []

  const loadDocument = async (..._params: any) => null

  const allDocuments = ref<any[]>([])

  const loadAllDocuments = async (..._params: any) => []

  const createDocument = async (..._params: any) => null

  const updateDocument = async (..._params: any) => null

  const deleteDocument = async (..._params: any) => true

  const reorderDocument = async (..._params: any) => null

  const moveDocument = async (..._params: any) => null

  const getDocumentAncestors = (..._params: any) => []

  return {
    documents,
    activeDocumentId,
    isLoadingDocuments,
    activeDocuments,
    activeDocument,
    documentTree,
    expandedDocIds,
    loadedParentIds,
    loadingParentIds,
    toggleCollapse,
    isCollapsed,
    expandDocument,
    isLoadingChildren,
    setActiveDocumentId,
    loadDocuments,
    loadChildren,
    allDocuments,
    loadDocument,
    loadAllDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    reorderDocument,
    moveDocument,
    getDocumentAncestors,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDocumentsStore as any, import.meta.hot))
}
