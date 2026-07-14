<script lang="ts" setup>
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'
import type { SourceType } from 'nocodb-sdk'

const router = useRouter()
const route = router.currentRoute

const baseStore = useBase()
const { base, sources, isSharedBase, isLoading } = storeToRefs(baseStore)

const tablesStore = useTablesStore()
const { openTable } = tablesStore
const { activeTables } = storeToRefs(tablesStore)

const { files, reset } = useFileDialog()

const { $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

type QuickImportTypes = 'excel' | 'json' | 'csv'

const allowedQuickImportTypes = [
  // Excel
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel.sheet.macroenabled.12', // .xlsm
  'application/vnd.oasis.opendocument.spreadsheet', // .ods
  'application/vnd.oasis.opendocument.spreadsheet-template', // .ots

  // CSV
  'text/csv',

  // JSON
  'application/json',
  'text/json',
]

watch(files, (nextFiles) => nextFiles && onFileSelect(nextFiles), { flush: 'post' })

function onFileSelect(fileList: FileList | null) {
  if (!fileList) return

  const files = Array.from(fileList).map((file) => file)

  onDrop(files)
}

function onDrop(droppedFiles: File[] | null) {
  if (!droppedFiles) return

  /** we can only handle one file per drop */
  if (droppedFiles.length > 1) {
    return message.error({
      content: `Only one file can be imported at a time.`,
      duration: 2,
    })
  }

  let fileType: QuickImportTypes | null = null
  const isValid = allowedQuickImportTypes.some((type) => {
    const isAllowed = droppedFiles[0].type === type

    if (isAllowed) {
      const ext = droppedFiles[0].name.split('.').pop()
      fileType = ext === 'csv' || ext === 'json' ? ext : ('excel' as QuickImportTypes)
    }

    return isAllowed
  })

  /** Invalid file type was dropped */
  if (!isValid) {
    return message.error({
      content: 'Invalid file type',
      duration: 2,
    })
  }

  if (fileType && isValid) {
    openQuickImportDialog(fileType, droppedFiles[0])
  }
}

function openQuickImportDialog(type: QuickImportTypes, file: File) {
  if (!base.value?.id) return

  $e(`a:actions:import-${type}`)

  const isOpen = ref(true)

  const { close, vNode } = useDialog(resolveComponent('DlgQuickImport'), {
    'modelValue': isOpen,
    'importType': type,
    'onUpdate:modelValue': closeDialog,
    'baseId': base.value.id,
    'sourceId': sources.value?.filter((source: SourceType) => source.enabled)[0].id,
  })

  vNode.value?.component?.exposed?.handleChange({
    file: {
      uid: `${type}-${file.name}-${Math.random().toString(36).substring(2)}`,
      name: file.name,
      type: file.type,
      status: 'done',
      fileName: file.name,
      lastModified: file.lastModified,
      size: file.size,
      originFileObj: file,
    },
    event: { percent: 100 },
  } as UploadChangeParam<UploadFile<File>>)

  function closeDialog() {
    isOpen.value = false

    close(1000)

    reset()
  }
}

const hideProjectViewPage = computed(() => {
  return isSharedBase.value
})

const showEmptySkeleton = ref(true)
const hasAttemptedAutoOpen = ref(false)

const showProjectViewPage = computed(() => {
  return activeTables.value.length === 0 || !!route.value.query.page || isUIAllowed('projectOverviewTab')
})

const showSharedBaseLoading = computed(() => {
  return isSharedBase.value && (isLoading.value || (!base.value?.id && !hasAttemptedAutoOpen.value))
})

const showSharedBaseEmpty = computed(() => {
  return (
    isSharedBase.value &&
    !showSharedBaseLoading.value &&
    !!base.value?.id &&
    activeTables.value.length === 0
  )
})

const hideEmptySkeleton = () => {
  if (!showEmptySkeleton.value) return

  nextTick(() => {
    showEmptySkeleton.value = false
  })
}

watch(
  [
    () => isSharedBase.value,
    () => activeTables.value.length,
    () => isUIAllowed('projectOverviewTab'),
    () => route.value.query.openTable === 'true',
    () => base.value?.id,
    () => isLoading.value,
  ],
  ([newIsSharedBase, newActiveTablesLength, isOverviewTabVisible, newOpenTable, baseId, loading]) => {
    if (loading) return

    // If no tables are active or if new sidebar is not enabled then return
    if (!newActiveTablesLength || !activeTables.value[0]?.base_id) {
      hasAttemptedAutoOpen.value = !!baseId
      hideEmptySkeleton()
      return
    }

    // If page is defined or overview tab is visible then return
    if (!newIsSharedBase && isOverviewTabVisible && !newOpenTable) {
      hideEmptySkeleton()
      return
    }

    hasAttemptedAutoOpen.value = true
    openTable(activeTables.value[0]!, true)
  },
  {
    immediate: true,
    flush: 'pre',
  },
)
</script>

<template>
  <div v-if="showSharedBaseLoading" class="h-full w-full flex items-center justify-center">
    <div class="flex flex-col items-center gap-3 text-nc-content-gray-subtle">
      <GeneralLoader size="xlarge" />
      <div class="text-sm">{{ $t('msg.info.loadingSharedBase') }}</div>
    </div>
  </div>

  <div
    v-else-if="showSharedBaseEmpty"
    class="h-full w-full flex items-center justify-center px-6"
    data-testid="nc-shared-base-empty"
  >
    <div class="max-w-md text-center flex flex-col items-center gap-3">
      <GeneralIcon icon="ncTable" class="h-10 w-10 text-nc-content-gray-muted" />
      <h2 class="text-lg font-semibold text-nc-content-gray m-0">
        {{ $t('title.sharedBaseNoVisibleContent') }}
      </h2>
      <p class="text-sm text-nc-content-gray-subtle2 m-0">
        {{ $t('msg.info.sharedBaseNoVisibleContent') }}
      </p>
    </div>
  </div>

  <ProjectView
    v-else-if="!hideProjectViewPage"
    :show-empty-skeleton="!showProjectViewPage || showEmptySkeleton"
    show-overview-tab
  />
</template>
