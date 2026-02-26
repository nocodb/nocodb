<script lang="ts" setup>
import type { DocumentType } from 'nocodb-sdk'

interface Props {
  doc: DocumentType
}

const props = defineProps<Props>()

const { $e } = useNuxtApp()
const { t } = useI18n()

const { isMobileMode, ncNavigateTo } = useGlobal()
const { isUIAllowed } = useRoles()
const documentsStore = useDocumentsStore()
const { updateDocument, deleteDocument, createDocument, loadDocument } = documentsStore
const { activeDocumentId } = storeToRefs(documentsStore)

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const base = inject(ProjectInj, ref())

const input = ref<HTMLInputElement>()

const isEditing = ref(false)
const isDropdownOpen = ref(false)
const _title = ref('')

/** Helper to check if editing was disabled before the document navigation timeout triggers */
const isStopped = ref(false)

// Controls whether the NcTooltip is active — disabled while
// the context-menu button is hovered to avoid tooltip overlap.
const showNodeTooltip = ref(true)

// Declare before usage in handleOnClick
const { meta: metaKey, control } = useMagicKeys()
const isMacOs = isMac()

const navigateToDocument = () => {
  if (isEditing.value) return

  ncNavigateTo({
    workspaceId: activeWorkspaceId.value,
    baseId: base.value?.id || props.doc.base_id,
    docId: props.doc.id,
    docTitle: props.doc.title,
  })
}

const onClick = useDebounceFn(() => {
  navigateToDocument()
}, 250)

const handleOnClick = () => {
  if (isEditing.value || isStopped.value) return

  const cmdOrCtrl = isMacOs ? metaKey?.value : control?.value

  // Cmd/Ctrl-click navigates immediately (skips debounce)
  if (cmdOrCtrl) {
    navigateToDocument()
  } else {
    onClick()
  }
}

const focusInput = () => {
  setTimeout(() => {
    input.value?.focus()
    input.value?.select()
  })
}

/** Enable editing document name on dbl click */
const onDblClick = () => {
  if (isMobileMode.value) return
  if (!isUIAllowed('documentUpdate')) return

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = props.doc.title || ''
    $e('c:document:rename')

    nextTick(() => {
      focusInput()
    })
  }
}

/** Rename a document */
const onRename = async () => {
  isDropdownOpen.value = false
  if (!isEditing.value) return

  if (_title.value) {
    _title.value = _title.value.trim()
  }

  if (!_title.value) {
    _title.value = props.doc.title || t('general.untitled')
  }

  if (_title.value === props.doc.title) {
    onCancel()
    return
  }

  if (base.value?.id) {
    await updateDocument(base.value.id, props.doc.id!, { title: _title.value, version: props.doc.version })
  }

  onStopEdit()
}

const isDeleteModalVisible = ref(false)

const onDelete = () => {
  isDropdownOpen.value = false
  isDeleteModalVisible.value = true
}

const confirmDelete = async () => {
  if (!base.value?.id || !props.doc.id) return
  await deleteDocument(base.value.id, props.doc.id)
}

const onDuplicate = async () => {
  isDropdownOpen.value = false
  if (!base.value?.id || !props.doc.id) return

  // Load full document content, then create a copy
  const fullDoc = await loadDocument(props.doc.id, false)
  if (!fullDoc) return

  await createDocument(base.value.id, {
    title: t('labels.copyOfDocument', { title: fullDoc.title || t('general.untitled') }),
    content: fullDoc.content,
  })
}

const updateDocumentIcon = async (icon: string) => {
  if (!props.doc?.id || !base.value?.id) return
  try {
    const updatedMeta = {
      ...parseProp(props.doc.meta),
      icon,
    }

    await updateDocument(base.value.id, props.doc.id, {
      meta: updatedMeta,
      version: props.doc.version,
    })

    $e('a:document:icon:sidebar', { icon })
  } catch (e: any) {
    ncMessage.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Handle keydown on input field */
const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.stopImmediatePropagation()
    e.preventDefault()
    onRename()
  } else if (e.key === 'Escape') {
    e.stopImmediatePropagation()
    e.preventDefault()
    onCancel()
  }
}

onKeyStroke('Enter', (event) => {
  if (isEditing.value) {
    event.stopImmediatePropagation()
    event.preventDefault()
    onRename()
  }
})

const onRenameMenuClick = () => {
  if (isMobileMode.value || !isUIAllowed('documentUpdate')) return

  isDropdownOpen.value = false

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = props.doc.title || ''
    $e('c:document:rename')

    nextTick(() => {
      focusInput()
    })
  }
}

/** Cancel renaming document */
function onCancel() {
  if (!isEditing.value) return

  onStopEdit()
}

/** Stop editing document name, timeout makes sure that document navigation (click trigger) does not pick up before stop is done */
function onStopEdit() {
  isStopped.value = true
  isEditing.value = false
  _title.value = ''

  setTimeout(() => {
    isStopped.value = false
  }, 250)
}
</script>

<template>
  <div
    class="nc-sidebar-node !pl-2 !xs:(pl-2) !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100 !min-h-7 !max-h-7 !my-0.5 select-none group text-nc-content-gray-subtle !flex !items-center hover:(!bg-nc-bg-gray-medium !text-nc-content-gray-subtle) cursor-pointer"
    :data-testid="`view-sidebar-doc-${doc.title}`"
    @dblclick.stop="onDblClick"
    @click.prevent="handleOnClick"
  >
    <div v-e="['a:document:open']" class="text-sm flex items-center w-full gap-1" data-testid="doc-item">
      <div
        v-e="['c:document:emoji-picker']"
        class="flex min-w-6"
        @mouseenter="showNodeTooltip = false"
        @mouseleave="showNodeTooltip = true"
        @click.stop
        @dblclick.stop
      >
        <LazyGeneralEmojiPicker
          :key="doc?.meta?.icon"
          :clearable="true"
          :emoji="doc?.meta?.icon"
          :readonly="isMobileMode || !isUIAllowed('documentUpdate')"
          class="nc-document-icon"
          size="small"
          @emoji-selected="updateDocumentIcon($event)"
        >
          <template #default>
            <GeneralIcon
              :class="activeDocumentId === doc.id ? '!text-nc-brand-600/85' : '!text-nc-gray-600/75'"
              class="nc-document-icon w-4 text-nc-content-gray-subtle !text-[16px]"
              icon="ncFileText"
            />
          </template>
        </LazyGeneralEmojiPicker>
      </div>

      <a-input
        v-if="isEditing"
        ref="input"
        v-model:value="_title"
        :class="{
          'font-semibold !text-nc-content-brand-disabled': activeDocumentId === doc.id,
        }"
        :style="{
          fontWeight: 'inherit',
        }"
        class="!bg-transparent !pr-1.5 !flex-1 mr-4 !rounded-md !h-6 animate-sidebar-node-input-padding"
        @blur="onRename"
        @keydown.stop="onKeyDown($event)"
      />
      <NcTooltip
        v-else
        class="nc-sidebar-node-title text-ellipsis overflow-hidden select-none w-full max-w-full"
        :disabled="!showNodeTooltip"
        show-on-truncate-only
      >
        <template #title> {{ doc.title || $t('general.untitled') }}</template>
        <div
          :class="{
            'font-semibold text-nc-content-brand-disabled': activeDocumentId === doc.id,
          }"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
          data-testid="sidebar-doc-title"
        >
          {{ doc.title || $t('general.untitled') }}
        </div>
      </NcTooltip>

      <template v-if="!isEditing">
        <NcDropdown v-model:visible="isDropdownOpen" overlay-class-name="!rounded-lg">
          <NcButton
            v-e="['c:document:option']"
            :class="{
              '!visible !opacity-100': isDropdownOpen,
            }"
            class="nc-sidebar-node-btn invisible !group-hover:(visible opacity-100) nc-sidebar-doc-node-context-btn"
            data-testid="docs-sidebar-page-options"
            size="xxsmall"
            type="text"
            @mouseenter="showNodeTooltip = false"
            @mouseleave="showNodeTooltip = true"
            @click.stop="isDropdownOpen = !isDropdownOpen"
            @dblclick.stop
          >
            <GeneralIcon class="text-xl w-4.75" icon="threeDotHorizontal" />
          </NcButton>

          <template #overlay>
            <NcMenu :data-testid="`sidebar-doc-context-menu-list-${doc.title}`" class="!min-w-62.5" variant="small">
              <NcMenuItemCopyId
                v-if="doc"
                :id="doc.id"
                v-e="['c:document:copy-id']"
                tooltip="Click to copy Document ID"
                :label="`DOCUMENT ID: ${doc.id}`"
                :data-testid="`sidebar-doc-copy-id-${doc.title}`"
              />
              <template v-if="isUIAllowed('documentUpdate')">
                <NcDivider />
                <NcMenuItem
                  v-e="['c:document:rename']"
                  :data-testid="`sidebar-doc-rename-${doc.title}`"
                  class="nc-document-rename"
                  @click="onRenameMenuClick"
                >
                  <GeneralIcon class="text-nc-content-gray-subtle" icon="rename" />
                  {{ $t('labels.renameDocument') }}
                </NcMenuItem>
              </template>
              <NcMenuItem
                v-if="isUIAllowed('documentCreate')"
                v-e="['c:document:duplicate']"
                :data-testid="`sidebar-doc-duplicate-${doc.title}`"
                @click="onDuplicate"
              >
                <GeneralIcon class="text-nc-content-gray-subtle" icon="duplicate" />
                {{ $t('labels.duplicateDocument') }}
              </NcMenuItem>
              <template v-if="isUIAllowed('documentDelete')">
                <NcDivider />
                <NcMenuItem
                  v-e="['c:document:delete']"
                  :data-testid="`sidebar-doc-delete-${doc.title}`"
                  class="!text-red-500 !hover:bg-red-50"
                  @click="onDelete"
                >
                  <GeneralIcon icon="delete" />
                  {{ $t('labels.deleteDocument') }}
                </NcMenuItem>
              </template>
            </NcMenu>
          </template>
        </NcDropdown>
      </template>
    </div>

    <GeneralDeleteModal v-model:visible="isDeleteModalVisible" :entity-name="$t('objects.document')" :on-delete="confirmDelete">
      <template #entity-preview>
        <div class="flex flex-row items-center py-2.25 px-2.5 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle">
          <GeneralIcon icon="ncFileText" class="text-nc-content-gray-subtle" />
          <div
            class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
          >
            {{ doc.title || $t('general.untitled') }}
          </div>
        </div>
      </template>
    </GeneralDeleteModal>
  </div>
</template>
