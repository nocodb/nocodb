<script lang="ts" setup>
import { type WorkflowType } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'

interface Props {
  workflow: WorkflowType
}

const props = defineProps<Props>()

const vModel = useVModel(props, 'workflow') as WritableComputedRef<WorkflowType & { created_by?: string }>

const { $e } = useNuxtApp()

const { t } = useI18n()

const { addUndo, defineModelScope } = useUndoRedo()

const { isMobileMode, user, ncNavigateTo } = useGlobal()

const { isSharedBase } = useBase()

const { basesUser } = storeToRefs(useBases())

const { isUIAllowed } = useRoles()

const workflowStore = useWorkflowStore()

const basesStore = useBases()

const { activeProjectId } = storeToRefs(basesStore)

const { duplicateWorkflow: _duplicateWorkflow, updateWorkflow } = workflowStore

const { activeWorkflowId, activeBaseWorkflows } = storeToRefs(workflowStore)

const { meta: metaKey, control } = useMagicKeys()

const { openWorkflowDescriptionDialog: _openWorkflowDescriptionDialog } = inject(TreeViewInj)!

const base = inject(ProjectInj, ref())

const input = ref<HTMLInputElement>()

const isDropdownOpen = ref(false)

const isEditing = ref(false)
/** Is editing the workflow name enabled */

/** Helper to check if editing was disabled before the workflow navigation timeout triggers */
const isStopped = ref(false)

/** Original workflow title when editing the workflow name */
const _title = ref<string | undefined>()

const showWorkflowNodeTooltip = ref(true)

const idUserMap = computed(() => {
  if (!base.value?.id) return {}
  return (basesUser.value.get(base.value?.id) || []).reduce((acc, user) => {
    acc[user.id] = user
    acc[user.email] = user
    return acc
  }, {} as Record<string, any>)
})

const changeWorkflow = (workflow: WorkflowType) => {
  ncNavigateTo({
    workspaceId: workflow.fk_workspace_id,
    baseId: workflow.base_id,
    workflowId: workflow.id,
    workflowTitle: workflow.title,
  })
}

/** Debounce click handler, so we can potentially enable editing workflow name {@see onDblClick} */
const onClick = useDebounceFn(() => {
  changeWorkflow(vModel.value)
}, 250)

const handleOnClick = () => {
  if (isEditing.value || isStopped.value) return

  const cmdOrCtrl = isMac() ? metaKey?.value : control?.value

  if (cmdOrCtrl) {
    changeWorkflow(vModel.value)
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

/** validate workflow title */
function validateWorkflowTitle(workflow: WorkflowType) {
  if (!workflow.title?.trim()) {
    return t('msg.error.workflowNameRequired')
  }

  if (activeBaseWorkflows.value.some((s) => s.title === workflow.title && s.id !== workflow.id)) {
    return t('msg.error.workflowNameDuplicate')
  }

  return true
}

/** Enable editing workflow name on dbl click */
function onDblClick() {
  if (isMobileMode.value) return
  if (!isUIAllowed('workflowCreateOrEdit')) return

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = vModel.value.title
    $e('c:workflow:rename')

    nextTick(() => {
      focusInput()
    })
  }
}

/** Handle keydown on input field */
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    onKeyEsc(event)
  } else if (event.key === 'Enter') {
    onKeyEnter(event)
  }
}

/** Rename workflow when enter is pressed */
function onKeyEnter(event: KeyboardEvent) {
  event.stopImmediatePropagation()
  event.preventDefault()

  onRename()
}

/** Disable renaming workflow when escape is pressed */
function onKeyEsc(event: KeyboardEvent) {
  event.stopImmediatePropagation()
  event.preventDefault()

  onCancel()
}

onKeyStroke('Enter', (event) => {
  if (isEditing.value) {
    onKeyEnter(event)
  }
})

const onRenameMenuClick = () => {
  if (isMobileMode.value || !isUIAllowed('workflowCreateOrEdit')) return

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = vModel.value.title
    $e('c:workflow:rename')

    nextTick(() => {
      focusInput()
    })
  }
}

async function onRenameWorkflow(workflow: WorkflowType, originalTitle?: string, undo = false) {
  if (!workflow?.id || !workflow?.base_id) return
  try {
    await updateWorkflow(workflow.base_id, workflow.id, {
      title: workflow.title,
      order: workflow.order,
    })

    if (!undo) {
      addUndo({
        redo: {
          fn: (s: WorkflowType, title: string) => {
            const tempTitle = s.title
            s.title = title
            onRenameWorkflow(s, tempTitle, true)
          },
          args: [workflow, workflow.title],
        },
        undo: {
          fn: (s: WorkflowType, title: string) => {
            const tempTitle = s.title
            s.title = title
            onRenameWorkflow(s, tempTitle, true)
          },
          args: [workflow, originalTitle],
        },
        scope: defineModelScope({ base_id: workflow.base_id }),
      })
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

/** Rename a workflow */
async function onRename() {
  isDropdownOpen.value = false
  if (!isEditing.value) return

  if (_title.value) {
    _title.value = _title.value.trim()
  }

  const isValid = validateWorkflowTitle({ ...vModel.value, title: _title.value! })

  if (isValid !== true) {
    message.error(isValid)

    onCancel()
    return
  }

  if (vModel.value.title === '' || vModel.value.title === _title.value) {
    onCancel()
    return
  }

  const originalTitle = vModel.value.title

  vModel.value.title = _title.value || ''

  await onRenameWorkflow(vModel.value, originalTitle)

  onStopEdit()
}

const openWorkflowDescriptionDialog = (workflow: WorkflowType) => {
  isDropdownOpen.value = false

  _openWorkflowDescriptionDialog?.(workflow)
}

/** Cancel renaming workflow */
function onCancel() {
  if (!isEditing.value) return

  onStopEdit()
}

/** Stop editing workflow name, timeout makes sure that workflow navigation (click trigger) does not pick up before stop is done */
function onStopEdit() {
  isStopped.value = true
  isEditing.value = false
  _title.value = ''

  setTimeout(() => {
    isStopped.value = false
  }, 250)
}

const isLoading = ref(false)

const duplicateWorkflow = async (workflow: WorkflowType) => {
  if (!activeProjectId.value || !workflow.id) return

  try {
    isLoading.value = true
    await _duplicateWorkflow(activeProjectId.value, workflow.id)
    isDropdownOpen.value = false
  } finally {
    isLoading.value = false
  }
}

const updateWorkflowIcon = async (icon: string, workflow: WorkflowType) => {
  if (!workflow?.id || !workflow?.base_id) return
  try {
    // modify the icon property in meta
    workflow.meta = {
      ...parseProp(workflow.meta),
      icon,
    }

    await updateWorkflow(workflow.base_id, workflow.id, {
      meta: workflow.meta,
    })

    $e('a:workflow:icon:sidebar', { icon })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const deleteWorkflow = () => {
  isDropdownOpen.value = false

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgWorkflowDelete'), {
    'visible': isOpen,
    'workflow': vModel.value,
    'onUpdate:visible': closeDialog,
    'onDeleted': () => {
      closeDialog()
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}
</script>

<template>
  <div
    class="nc-sidebar-node !pl-2 !xs:(pl-2) !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100 !min-h-7 !max-h-7 !my-0.5 select-none group text-nc-content-gray-subtle !flex !items-center hover:(!bg-nc-bg-gray-medium !text-nc-content-gray-subtle) cursor-pointer"
    :data-testid="`view-sidebar-workflow-${vModel.title}`"
    @dblclick.stop="onDblClick"
    @click.prevent="handleOnClick"
  >
    <NcTooltip
      :disabled="isEditing || isDropdownOpen || !showWorkflowNodeTooltip"
      :overlay-inner-style="{ width: '240px' }"
      :tooltip-style="{ width: '240px', zIndex: '1049' }"
      placement="right"
      trigger="hover"
      class="w-full"
      :mouse-enter-delay="0.5"
    >
      <template #title>
        <div class="flex flex-col gap-3">
          <div>
            <div class="text-[10px] leading-[14px] text-nc-content-brand-hover dark:text-nc-content-gray-muted uppercase mb-1">
              {{ $t('labels.workflowName') }}
            </div>
            <div class="text-small leading-[18px]">{{ vModel.title }}</div>
            <div class="mt-1 text-xs whitespace-pre-wrap break-words">{{ vModel.description }}</div>
          </div>
          <div v-if="vModel?.created_by && idUserMap[vModel?.created_by]">
            <div class="text-[10px] leading-[14px] text-nc-content-brand-hover dark:text-nc-content-gray-muted uppercase mb-1">
              {{ $t('labels.createdBy') }}
            </div>
            <div class="text-xs">
              {{
                idUserMap[vModel?.created_by]?.id === user?.id
                  ? $t('general.you')
                  : idUserMap[vModel?.created_by]?.display_name || idUserMap[vModel?.created_by]?.email
              }}
            </div>
          </div>
        </div>
      </template>
      <div v-e="['a:workflow:open']" class="text-sm flex items-center w-full gap-1" data-testid="workflow-item">
        <div
          v-e="['c:workflow:emoji-picker']"
          :data-testid="`view-sidebar-drag-handle-${vModel.title}`"
          class="flex min-w-6"
          @mouseenter="showWorkflowNodeTooltip = false"
          @mouseleave="showWorkflowNodeTooltip = true"
        >
          <LazyGeneralEmojiPicker
            :key="props.workflow?.meta?.icon"
            :clearable="true"
            :emoji="props.workflow?.meta?.icon"
            :readonly="isMobileMode || !isUIAllowed('viewCreateOrEdit')"
            class="nc-workflow-icon"
            size="small"
            @emoji-selected="updateWorkflowIcon($event, vModel)"
          >
            <template #default>
              <GeneralIcon
                :class="activeWorkflowId === vModel.id ? '!text-nc-brand-600/85' : '!text-nc-gray-600/75'"
                class="nc-workflow-icon w-4 text-nc-content-gray-subtle !text-[16px]"
                icon="ncAutomation"
              />
            </template>
          </LazyGeneralEmojiPicker>
        </div>

        <a-input
          v-if="isEditing"
          ref="input"
          v-model:value="_title"
          :class="{
            'font-semibold !text-nc-content-brand-disabled': activeWorkflowId === vModel.id,
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
          disabled
          show-on-truncate-only
        >
          <template #title> {{ vModel.title }}</template>
          <div
            :class="{
              'font-semibold text-nc-content-brand-disabled': activeWorkflowId === vModel.id,
            }"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            data-testid="sidebar-workflow-title"
          >
            {{ vModel.title }}
          </div>
        </NcTooltip>
        <template v-if="!isEditing">
          <NcTooltip
            v-if="vModel.description?.length"
            placement="bottom"
            @mouseenter="showWorkflowNodeTooltip = false"
            @mouseleave="showWorkflowNodeTooltip = true"
          >
            <template #title>
              <div class="whitespace-pre-wrap break-words">{{ vModel.description }}</div>
            </template>
            <NcButton class="!hover:bg-transparent" size="xsmall" type="text">
              <GeneralIcon
                class="!w-3.5 !h-3.5 nc-info-icon group-hover:opacity-100 text-nc-content-gray-subtle2 opacity-0"
                icon="info"
              />
            </NcButton>
          </NcTooltip>
          <NcDropdown v-model:visible="isDropdownOpen" overlay-class-name="!rounded-lg">
            <NcButton
              v-e="['c:workflow:option']"
              :class="{
                '!visible !opacity-100': isDropdownOpen,
              }"
              class="nc-sidebar-node-btn invisible !group-hover:(visible opacity-100) nc-sidebar-workflow-node-context-btn"
              size="xxsmall"
              type="text"
              @mouseenter="showWorkflowNodeTooltip = false"
              @mouseleave="showWorkflowNodeTooltip = true"
              @click.stop="isDropdownOpen = !isDropdownOpen"
              @dblclick.stop
            >
              <GeneralIcon class="text-xl w-4.75" icon="threeDotHorizontal" />
            </NcButton>

            <template #overlay>
              <NcMenu :data-testid="`sidebar-workflow-context-menu-list-${workflow.title}`" class="!min-w-62.5" variant="small">
                <NcMenuItemCopyId
                  v-if="workflow?.id"
                  :id="workflow.id"
                  :label="
                    $t('labels.workflowIdColon', {
                      workflowId: workflow?.id,
                    })
                  "
                  :tooltip="$t('labels.clickToCopyWorkflowID')"
                />
                <template v-if="!isSharedBase && isUIAllowed('workflowCreateOrEdit')">
                  <NcDivider />
                  <NcMenuItem
                    v-e="['c:workflow:rename']"
                    :data-testid="`sidebar-workflow-rename-${workflow.title}`"
                    class="nc-workflow-rename"
                    @click="onRenameMenuClick"
                  >
                    <GeneralIcon class="text-nc-content-gray-subtle" icon="rename" />
                    {{ $t('general.rename') }} {{ 'Workflow'.toLowerCase() }}
                  </NcMenuItem>

                  <NcMenuItem
                    v-e="['c:workflow:update-description']"
                    :data-testid="`sidebar-workflow-description-${workflow.title}`"
                    class="nc-workflow-description"
                    @click="openWorkflowDescriptionDialog(workflow)"
                  >
                    <GeneralIcon class="text-nc-content-gray-subtle" icon="ncAlignLeft" />
                    {{ $t('labels.editDescription') }}
                  </NcMenuItem>
                  <NcDivider />
                  <NcMenuItem
                    v-e="['c:workflow:duplicate']"
                    :data-testid="`sidebar-workflow-duplicate-${workflow.title}`"
                    class="nc-workflow-duplicate"
                    @click="duplicateWorkflow(workflow)"
                  >
                    <GeneralLoader v-if="isLoading" />
                    <GeneralIcon v-else class="text-nc-content-gray-subtle" icon="duplicate" />
                    {{ $t('general.duplicate') }} {{ 'Workflow'.toLowerCase() }}
                  </NcMenuItem>
                  <NcDivider />
                  <NcMenuItem
                    v-e="['c:table:delete']"
                    :data-testid="`sidebar-workflow-delete-${workflow.title}`"
                    class="nc-workflow-delete"
                    danger
                    @click="deleteWorkflow"
                  >
                    <GeneralIcon icon="delete" />
                    {{ $t('general.delete') }} {{ 'Workflow'.toLowerCase() }}
                  </NcMenuItem>
                </template>
              </NcMenu>
            </template>
          </NcDropdown>
        </template>
      </div>
    </NcTooltip>
  </div>
</template>
