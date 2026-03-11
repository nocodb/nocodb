<script lang="ts" setup>
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'
import type { DocumentType } from 'nocodb-sdk'

interface Props {
  doc: DocumentType
  depth?: number
  hasChildren?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0,
  hasChildren: false,
})

const { $e } = useNuxtApp()
const { t } = useI18n()

const { isMobileMode, ncNavigateTo } = useGlobal()

const { isUIAllowed } = useRoles()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const documentsStore = useDocumentsStore()
const {
  updateDocument,
  deleteDocument,
  createDocument,
  loadDocument,
  expandDocument,
  toggleCollapse,
  moveDocument,
  isLoadingChildren,
} = documentsStore
const { activeDocumentId, expandedDocIds } = storeToRefs(documentsStore)

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const base = inject(ProjectInj, ref())

const input = ref<HTMLInputElement>()

const emojiPickerRef = ref<HTMLElement>()

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

const MAX_INDENT_DEPTH = 8

const indentStyle = computed(() => ({
  paddingLeft: `${8 + Math.min(props.depth, MAX_INDENT_DEPTH) * 8}px`,
}))

// Show chevron if either the tree node has loaded children OR the API says children exist
const showChevron = computed(() => props.hasChildren || !!props.doc.has_children)

const collapsed = computed(() => !expandedDocIds.value.has(props.doc.id!))

const loadingChildren = computed(() => (props.doc.id ? isLoadingChildren(props.doc.id) : false))

const onToggleCollapse = async () => {
  if (!props.doc.id) return
  const baseId = base.value?.id || props.doc.base_id
  if (!baseId) return

  if (collapsed.value) {
    // Expand — lazy-loads children if not yet fetched, then un-collapses
    await expandDocument(baseId, props.doc.id)
  } else {
    toggleCollapse(props.doc.id)
  }
}

const onCreateSubDocument = async () => {
  isDropdownOpen.value = false
  if (!base.value?.id || !props.doc.id) return
  await createDocument(base.value.id, { parent_id: props.doc.id })
}

const onMoveToRoot = async () => {
  isDropdownOpen.value = false
  if (!base.value?.id || !props.doc.id) return

  // Place at the end of root-level documents
  const { documents: allDocuments } = storeToRefs(documentsStore)
  const baseDocuments = allDocuments.value.get(base.value.id) || []
  const rootDocs = baseDocuments.filter((d) => !d.parent_id)
  const maxOrder = rootDocs.reduce((max, d) => Math.max(max, d.order || 0), 0)

  await moveDocument(base.value.id, props.doc.id, null, maxOrder + 1)
}

const navigateToDocument = () => {
  if (isEditing.value) return

  ncNavigateTo({
    workspaceId: activeWorkspaceId.value,
    baseId: base.value?.id || props.doc.base_id,
    docId: props.doc.id,
    docTitle: props.doc.title,
  })

  if (isMobileMode.value) {
    isLeftSidebarOpen.value = false
  }
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
const isPermissionsDialogVisible = ref(false)

const onPermissions = () => {
  isDropdownOpen.value = false
  isPermissionsDialogVisible.value = true
}

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
    parent_id: props.doc.parent_id,
    meta: fullDoc.meta,
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

const onChangeIcon = () => {
  isDropdownOpen.value = false
  nextTick(() => {
    emojiPickerRef.value?.querySelector<HTMLElement>('.nc-emoji')?.click()
  })
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
    class="nc-sidebar-node !rounded-md !pr-0.75 !py-0.5 w-full transition-all ease-in duration-100 !min-h-7 !max-h-7 !my-0.5 select-none group text-nc-content-gray-subtle text-bodyDefaultSm font-medium !flex !items-center hover:(!bg-nc-bg-gray-medium !text-nc-content-gray-subtle) cursor-pointer"
    :style="indentStyle"
    :data-testid="`view-sidebar-doc-${doc.title}`"
    @dblclick.stop="onDblClick"
    @click.prevent="handleOnClick"
  >
    <div v-e="['a:document:open']" class="flex items-center w-full gap-1" data-testid="doc-item">
      <!-- Mobile: plain chevron before icon (visible only on xs) -->
      <div
        class="hidden !xs:(flex items-center justify-center) w-5 h-5 flex-none"
        :class="showChevron ? 'cursor-pointer' : 'cursor-default'"
        @click.stop="showChevron && onToggleCollapse()"
        @dblclick.stop
      >
        <GeneralLoader v-if="loadingChildren" class="!w-3.5 !h-3.5" />
        <GeneralIcon
          v-else
          icon="chevronRight"
          class="transform transition-transform duration-200"
          :class="[
            showChevron ? 'text-nc-content-gray-subtle2' : 'text-nc-content-gray-muted cursor-not-allowed',
            { '!rotate-90': !collapsed && showChevron },
          ]"
        />
      </div>

      <!-- Icon wrapper with desktop chevron overlay -->
      <div
        class="flex items-center nc-doc-icon-wrapper min-w-6 h-6 relative"
        @mouseenter="showNodeTooltip = false"
        @mouseleave="showNodeTooltip = true"
        @click.stop
        @dblclick.stop
      >
        <!-- Desktop: chevron overlay — always swaps with icon on hover.
             When no children: muted, not-allowed cursor, non-interactive. -->
        <NcButton
          v-e="['c:document:toggle-expand']"
          type="text"
          size="xxsmall"
          class="nc-doc-chevron-btn !absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 !rounded-md !xs:hidden"
          :class="
            showChevron
              ? 'text-nc-content-gray-subtle2 hover:text-nc-content-gray cursor-pointer'
              : '!text-nc-content-gray-muted '
          "
          :disabled="!showChevron"
          @click.stop="showChevron && onToggleCollapse()"
          @dblclick.stop
        >
          <GeneralLoader v-if="loadingChildren" class="!w-3.5 !h-3.5" />
          <GeneralIcon
            v-else
            icon="chevronRight"
            class="transform transition-transform duration-200 text-current"
            :class="{
              '!rotate-90': !collapsed && showChevron,
            }"
          />
        </NcButton>

        <!-- Document icon/emoji — always hidden on hover (chevron replaces it).
             pointer-events-none: icon changes go via "Change Icon" context menu. -->
        <div
          ref="emojiPickerRef"
          v-e="['c:document:emoji-picker']"
          class="flex items-center group-hover:opacity-0 xs:group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
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
      </div>

      <a-input
        v-if="isEditing"
        ref="input"
        v-model:value="_title"
        :class="{
          'font-medium !text-nc-content-brand-disabled': activeDocumentId === doc.id,
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
          class="flex items-center gap-1"
          :class="{
            'font-medium text-nc-content-brand-disabled': activeDocumentId === doc.id,
          }"
        >
          <span
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap' }"
            data-testid="sidebar-doc-title"
            class="truncate"
          >
            {{ doc.title || $t('general.untitled') }}
          </span>
          <NcTooltip v-if="doc.has_permissions">
            <template #title>{{ $t('tooltip.restrictedPermissions') }}</template>
            <GeneralIcon
              icon="ncLock"
              class="flex-none text-nc-content-gray-muted !w-3 !h-3"
              data-testid="sidebar-doc-lock-icon"
            />
          </NcTooltip>
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

                <NcMenuItemChangeIcon
                  v-e="['c:document:change-icon']"
                  :disabled="!!isMobileMode"
                  :data-testid="`sidebar-doc-change-icon-${doc.title}`"
                  @change-icon="onChangeIcon"
                />
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
              <NcMenuItem
                v-if="isUIAllowed('documentCreate')"
                v-e="['c:document:create-sub']"
                :data-testid="`sidebar-doc-create-sub-${doc.title}`"
                @click="onCreateSubDocument"
              >
                <GeneralIcon class="text-nc-content-gray-subtle" icon="plus" />
                {{ $t('labels.newSubDocument') }}
              </NcMenuItem>
              <NcMenuItem
                v-if="doc.parent_id && isUIAllowed('documentUpdate')"
                v-e="['c:document:move-to-root']"
                :data-testid="`sidebar-doc-move-root-${doc.title}`"
                @click="onMoveToRoot"
              >
                <GeneralIcon class="text-nc-content-gray-subtle" icon="arrowUp" />
                {{ $t('labels.moveToRoot') }}
              </NcMenuItem>
              <template v-if="isEeUI && isUIAllowed('documentUpdate')">
                <NcDivider />
                <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS">
                  <template #default="{ click }">
                    <NcMenuItem
                      v-e="['c:document:permissions']"
                      :data-testid="`sidebar-doc-permissions-${doc.title}`"
                      class="nc-document-permissions"
                      @click="
                        click(PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS, () => {
                          onPermissions()
                        })
                      "
                    >
                      <div class="flex gap-2 items-center w-full">
                        <GeneralIcon icon="ncLock" class="opacity-80" />
                        <div class="flex-1">
                          {{ $t('title.pagePermissions') }}
                        </div>

                        <LazyPaymentUpgradeBadge
                          :feature="PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS"
                          :title="$t('upgrade.upgradeToUseDocumentPermissions')"
                          :content="
                            $t('upgrade.upgradeToUseDocumentPermissionsSubtitle', {
                              plan: PlanTitles.BUSINESS,
                            })
                          "
                        />
                      </div>
                    </NcMenuItem>
                  </template>
                </PaymentUpgradeBadgeProvider>
              </template>
              <template v-if="isUIAllowed('documentDelete')">
                <NcDivider />
                <NcMenuItem v-e="['c:document:delete']" :data-testid="`sidebar-doc-delete-${doc.title}`" danger @click="onDelete">
                  <GeneralIcon icon="delete" />
                  {{ $t('labels.deleteDocument') }}
                </NcMenuItem>
              </template>
            </NcMenu>
          </template>
        </NcDropdown>
        <NcTooltip v-if="isUIAllowed('documentCreate')" placement="top">
          <template #title>{{ $t('labels.newSubDocument') }}</template>
          <NcButton
            v-e="['c:document:create-sub:sidebar']"
            class="nc-sidebar-node-btn invisible !group-hover:(visible opacity-100)"
            data-testid="docs-sidebar-add-sub-page"
            size="xxsmall"
            type="text"
            @mouseenter="showNodeTooltip = false"
            @mouseleave="showNodeTooltip = true"
            @click.stop="onCreateSubDocument"
            @dblclick.stop
          >
            <GeneralIcon icon="plus" />
          </NcButton>
        </NcTooltip>
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

    <DlgDocPermissions
      v-if="doc.id && isEeUI"
      v-model:visible="isPermissionsDialogVisible"
      :doc-id="doc.id"
      :title="doc.title"
      :parent-id="doc.parent_id"
    />
  </div>
</template>
