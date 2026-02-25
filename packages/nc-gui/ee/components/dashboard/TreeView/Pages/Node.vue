<script lang="ts" setup>
import type { DocType } from 'nocodb-sdk'

interface Props {
  doc: DocType
}

const props = defineProps<Props>()

const { $e } = useNuxtApp()

const { isMobileMode, ncNavigateTo } = useGlobal()
const { isUIAllowed } = useRoles()

const docsStore = useDocsStore()
const { updateDoc, deleteDoc, createDoc, loadDoc } = docsStore
const { activeDocId } = storeToRefs(docsStore)

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const base = inject(ProjectInj, ref())

const input = ref<HTMLInputElement>()

const isEditing = ref(false)
const isDropdownOpen = ref(false)
const _title = ref('')

/** Helper to check if editing was disabled before the doc navigation timeout triggers */
const isStopped = ref(false)

// Controls whether the NcTooltip is active — disabled while
// the context-menu button is hovered to avoid tooltip overlap.
const showNodeTooltip = ref(true)

// Declare before usage in handleOnClick
const { meta: metaKey, control } = useMagicKeys()
const isMacOs = isMac()

const navigateToDoc = () => {
  if (isEditing.value) return

  ncNavigateTo({
    workspaceId: activeWorkspaceId.value,
    baseId: base.value?.id || props.doc.base_id,
    docId: props.doc.id,
    docTitle: props.doc.title,
  })
}

const onClick = useDebounceFn(() => {
  navigateToDoc()
}, 250)

const handleOnClick = () => {
  if (isEditing.value || isStopped.value) return

  const cmdOrCtrl = isMacOs ? metaKey?.value : control?.value

  // Cmd/Ctrl-click navigates immediately (skips debounce)
  if (cmdOrCtrl) {
    navigateToDoc()
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

/** Enable editing doc name on dbl click */
const onDblClick = () => {
  if (isMobileMode.value) return
  if (!isUIAllowed('docUpdate')) return

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = props.doc.title || ''
    $e('c:doc:rename')

    nextTick(() => {
      focusInput()
    })
  }
}

/** Rename a doc */
const onRename = async () => {
  isDropdownOpen.value = false
  if (!isEditing.value) return

  if (_title.value) {
    _title.value = _title.value.trim()
  }

  if (!_title.value) {
    _title.value = props.doc.title || 'Untitled'
  }

  if (_title.value === props.doc.title) {
    onCancel()
    return
  }

  if (base.value?.id) {
    await updateDoc(base.value.id, props.doc.id!, { title: _title.value, version: props.doc.version })
  }

  onStopEdit()
}

const onDelete = () => {
  if (!base.value?.id) return

  isDropdownOpen.value = false

  Modal.confirm({
    title: `Delete page "${props.doc.title || 'Untitled'}"?`,
    okText: 'Delete',
    okType: 'danger',
    cancelText: 'Cancel',
    wrapClassName: 'nc-modal-doc-delete',
    async onOk() {
      await deleteDoc(base.value!.id!, props.doc.id!)
    },
  })
}

const onDuplicate = async () => {
  isDropdownOpen.value = false
  if (!base.value?.id || !props.doc.id) return

  // Load full doc content, then create a copy
  const fullDoc = await loadDoc(props.doc.id, false)
  if (!fullDoc) return

  await createDoc(base.value.id, {
    title: `Copy of ${fullDoc.title || 'Untitled'}`,
    content: fullDoc.content,
  })
}

const updateDocIcon = async (icon: string) => {
  if (!props.doc?.id || !base.value?.id) return
  try {
    props.doc.meta = {
      ...parseProp(props.doc.meta),
      icon,
    }

    await updateDoc(base.value.id, props.doc.id, {
      meta: props.doc.meta,
      version: props.doc.version,
    })

    $e('a:doc:icon:sidebar', { icon })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
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
  if (isMobileMode.value || !isUIAllowed('docUpdate')) return

  isDropdownOpen.value = false

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = props.doc.title || ''
    $e('c:doc:rename')

    nextTick(() => {
      focusInput()
    })
  }
}

/** Cancel renaming doc */
function onCancel() {
  if (!isEditing.value) return

  onStopEdit()
}

/** Stop editing doc name, timeout makes sure that doc navigation (click trigger) does not pick up before stop is done */
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
    <div v-e="['a:doc:open']" class="text-sm flex items-center w-full gap-1" data-testid="doc-item">
      <div
        v-e="['c:doc:emoji-picker']"
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
          :readonly="isMobileMode || !isUIAllowed('docUpdate')"
          class="nc-doc-icon"
          size="small"
          @emoji-selected="updateDocIcon($event)"
        >
          <template #default>
            <GeneralIcon
              :class="activeDocId === doc.id ? '!text-nc-brand-600/85' : '!text-nc-gray-600/75'"
              class="nc-doc-icon w-4 text-nc-content-gray-subtle !text-[16px]"
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
          'font-semibold !text-nc-content-brand-disabled': activeDocId === doc.id,
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
        <template #title> {{ doc.title || 'Untitled' }}</template>
        <div
          :class="{
            'font-semibold text-nc-content-brand-disabled': activeDocId === doc.id,
          }"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
          data-testid="sidebar-doc-title"
        >
          {{ doc.title || 'Untitled' }}
        </div>
      </NcTooltip>

      <template v-if="!isEditing">
        <NcDropdown v-model:visible="isDropdownOpen" overlay-class-name="!rounded-lg">
          <NcButton
            v-e="['c:doc:option']"
            :class="{
              '!visible !opacity-100': isDropdownOpen,
            }"
            class="nc-sidebar-node-btn invisible !group-hover:(visible opacity-100) nc-sidebar-doc-node-context-btn"
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
                v-e="['c:doc:copy-id']"
                :id="doc.id"
                tooltip="Click to copy Page ID"
                :label="`PAGE ID: ${doc.id}`"
                :data-testid="`sidebar-doc-copy-id-${doc.title}`"
              />
              <template v-if="isUIAllowed('docUpdate')">
                <NcDivider />
                <NcMenuItem
                  v-e="['c:doc:rename']"
                  :data-testid="`sidebar-doc-rename-${doc.title}`"
                  class="nc-doc-rename"
                  @click="onRenameMenuClick"
                >
                  <GeneralIcon class="text-nc-content-gray-subtle" icon="rename" />
                  Rename page
                </NcMenuItem>
              </template>
              <NcMenuItem
                v-if="isUIAllowed('docCreate')"
                v-e="['c:doc:duplicate']"
                :data-testid="`sidebar-doc-duplicate-${doc.title}`"
                @click="onDuplicate"
              >
                <GeneralIcon class="text-nc-content-gray-subtle" icon="duplicate" />
                Duplicate page
              </NcMenuItem>
              <template v-if="isUIAllowed('docDelete')">
                <NcDivider />
                <NcMenuItem
                  v-e="['c:doc:delete']"
                  :data-testid="`sidebar-doc-delete-${doc.title}`"
                  class="!text-red-500 !hover:bg-red-50"
                  @click="onDelete"
                >
                  <GeneralIcon icon="delete" />
                  Delete page
                </NcMenuItem>
              </template>
            </NcMenu>
          </template>
        </NcDropdown>
      </template>
    </div>
  </div>
</template>
