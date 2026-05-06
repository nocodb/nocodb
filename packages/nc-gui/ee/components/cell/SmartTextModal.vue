<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  visible: boolean
  tableId?: string | null
  rowId?: string | null
  columnId?: string | null
  columnTitle?: string | null
  column?: ColumnType | null
  readOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  tableId: null,
  rowId: null,
  columnId: null,
  columnTitle: null,
  column: null,
  readOnly: false,
})

const emits = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'saved', markdown: string | null): void
}>()

interface SmartTextGetResponse {
  pm: Record<string, any> | null
  markdown: string | null
}

const { $api } = useNuxtApp()

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()

const { activeProjectId } = storeToRefs(basesStore)

// Shared-view context — when present we use the public endpoint instead of
// the internal op (the latter requires workspace/base auth which a shared
// view token doesn't grant). The modal stays read-only in that mode.
const isPublic = inject(IsPublicInj, ref(false))

const sharedViewPassword = inject(SharedViewPasswordInj, ref<string | null>(null))

const route = useRoute()

const sharedViewUuid = computed(() => (isPublic.value ? (route.params.viewId as string | undefined) ?? null : null))

const isVisible = useVModel(props, 'visible', emits)

const pmContent = ref<Record<string, any> | null>(null)

const isLoading = ref(false)

const isSaving = ref(false)

const isDirty = ref(false)

const loadedKey = ref<string | null>(null)

const cellKey = (tableId: string, rowId: string, columnId: string) => `${tableId}|${rowId}|${columnId}`

const hasIds = computed(() => {
  if (!props.tableId || !props.rowId || !props.columnId) return false
  if (isPublic.value) return !!sharedViewUuid.value
  return !!(activeWorkspaceId.value && activeProjectId.value)
})

const currentKey = () => {
  if (!hasIds.value) return null
  return cellKey(props.tableId!, props.rowId!, props.columnId!)
}

const loadContent = async () => {
  if (!hasIds.value) return

  const reqKey = currentKey()!

  isLoading.value = true
  pmContent.value = null
  loadedKey.value = null

  try {
    let result: SmartTextGetResponse

    if (isPublic.value) {
      // Public-shared-view path — uses the dedicated public endpoint with
      // the shared-view password header. Read-only; no save endpoint.
      result = (await $api.public.dataSmartTextRead(
        sharedViewUuid.value!,
        props.rowId!,
        props.columnId!,
        sharedViewPassword.value ? { headers: { 'xc-password': sharedViewPassword.value } } : {},
      )) as unknown as SmartTextGetResponse
    } else {
      result = (await $api.internal.getOperation(activeWorkspaceId.value!, activeProjectId.value!, {
        operation: 'smartTextGetContent',
        tableId: props.tableId!,
        rowId: props.rowId!,
        columnId: props.columnId!,
      })) as SmartTextGetResponse
    }

    if (currentKey() !== reqKey) return

    pmContent.value = result?.pm ?? null
    loadedKey.value = reqKey
    isDirty.value = false
  } catch (e: any) {
    if (currentKey() === reqKey) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  } finally {
    if (currentKey() === reqKey) isLoading.value = false
  }
}

const flushSave = async () => {
  if (props.readOnly || isPublic.value) return
  if (!isDirty.value || isSaving.value) return
  if (!hasIds.value || !pmContent.value) return

  const reqKey = currentKey()!

  isSaving.value = true
  try {
    const result = (await $api.internal.postOperation(
      activeWorkspaceId.value!,
      activeProjectId.value!,
      {
        operation: 'smartTextUpdateContent',
        tableId: props.tableId!,
        rowId: props.rowId!,
        columnId: props.columnId!,
      },
      { pmContent: pmContent.value },
    )) as SmartTextGetResponse

    const newMarkdown = result?.markdown ?? null

    emits('saved', newMarkdown)

    if (currentKey() === reqKey) isDirty.value = false
  } catch (e: any) {
    if (currentKey() === reqKey) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  } finally {
    if (currentKey() === reqKey) isSaving.value = false
  }
}

const onContentUpdate = (content: Record<string, any>) => {
  if (props.readOnly) return
  pmContent.value = content
  isDirty.value = true
}

const close = async () => {
  if (isDirty.value) await flushSave()
  isVisible.value = false
}

// Provide cell-keyed attachment context so the embedded doc editor's
// image/file URLs resolve via the cell endpoint, mirroring SmartTextPanel.
const cellAttachmentContext = computed(() => {
  if (!props.tableId || !props.columnId || !props.rowId) return null
  return { tableId: props.tableId, columnId: props.columnId, rowId: props.rowId }
})
provide(SmartTextCellAttachmentInj, cellAttachmentContext)

// Session-end save triggers — match SmartTextPanel semantics.
const onVisibilityChange = () => {
  if (document.hidden && isDirty.value) flushSave()
}

const onBeforeUnload = () => {
  if (isDirty.value) flushSave()
}

watch(isVisible, (open) => {
  if (open) {
    loadContent()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)
  } else {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('beforeunload', onBeforeUnload)
    pmContent.value = null
    loadedKey.value = null
    isDirty.value = false
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.stopPropagation()
    close()
  }
}

const saveStatusLabel = computed(() => {
  if (props.readOnly) return ''
  if (isSaving.value) return t('general.saving')
  if (isDirty.value) return t('labels.unsavedChanges')
  return ''
})

const editorInitialContent = computed(() => pmContent.value ?? null)
</script>

<template>
  <a-modal
    v-model:visible="isVisible"
    :closable="false"
    :footer="null"
    :mask="true"
    :mask-closable="true"
    wrap-class-name="nc-smart-text-modal"
    :z-index="1052"
    @cancel="close"
  >
    <div
      class="flex flex-col w-full h-full nc-smart-text-modal-body"
      tabindex="-1"
      data-testid="nc-smart-text-modal"
      @keydown="onKeydown"
    >
      <!-- Header -->
      <div class="flex items-center gap-2 h-[var(--topbar-height)] px-3 py-2 border-b border-nc-border-gray-medium flex-shrink-0">
        <div class="flex items-center gap-2 text-nc-content-gray-subtle px-1 min-w-0">
          <SmartsheetHeaderIcon v-if="column" :column="column" />
          <GeneralIcon v-else icon="ncFileText" class="w-4 h-4 flex-shrink-0" />
          <NcTooltip show-on-truncate-only class="truncate max-w-48">
            <template #title>{{ columnTitle }}</template>
            <span class="text-bodyDefaultSm font-medium leading-normal">
              {{ columnTitle || $t('general.untitled') }}
            </span>
          </NcTooltip>
        </div>

        <span
          v-if="saveStatusLabel"
          class="text-captionSm text-nc-content-gray-muted"
          data-testid="nc-smart-text-modal-save-status"
        >
          {{ saveStatusLabel }}
        </span>

        <div class="flex-1" />

        <NcTooltip :title="$t('general.close')">
          <NcButton
            size="xs"
            type="text"
            :aria-label="$t('general.close')"
            data-testid="nc-smart-text-modal-close"
            @click="close"
          >
            <GeneralIcon icon="close" class="w-4 h-4" />
          </NcButton>
        </NcTooltip>
      </div>

      <!-- Body — full noco-docs editor in cell mode -->
      <div class="flex-1 min-h-0 overflow-hidden">
        <div v-if="isLoading" class="flex items-center justify-center h-full">
          <GeneralLoader />
        </div>
        <div v-else class="h-full overflow-auto">
          <LazyDocEditor
            mode="cell"
            embedded
            :read-only="readOnly || isPublic"
            :initial-content="editorInitialContent"
            @update:content="onContentUpdate"
          />
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style lang="scss">
.nc-smart-text-modal {
  .ant-modal {
    @apply !w-full h-full !top-0 !mx-auto !my-0;

    .ant-modal-content {
      @apply absolute !p-0 left-[50%] top-[50%];

      transform: translate(-50%, -50%);

      width: min(1280px, 100vw - 100px);
      height: min(864px, 100vh - 100px);

      @supports (height: 100dvh) {
        height: min(864px, 100dvh - 100px);
      }

      @media (max-width: 767px) {
        width: min(1280px, 100vw - 32px);
      }
    }

    .ant-modal-body {
      @apply !p-0 h-full;
    }
  }
}
</style>
