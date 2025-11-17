<script lang="ts" setup>
import { type WorkflowType } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'

interface Props {
  workflow: WorkflowType
  onValidate: (workflow: WorkflowType) => boolean | string
}

interface Emits {
  (event: 'update:workflow', data: Record<string, any>): void

  (event: 'selectIcon', icon: string): void

  (event: 'changeWorkflow', workflow: Record<string, any>): void

  (event: 'rename', workflow: WorkflowType, title: string | undefined): void

  (event: 'delete', workflow: WorkflowType): void

  (event: 'openModal', data: { type: WorkflowType }): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'workflow', emits) as WritableComputedRef<WorkflowType & { created_by?: string }>

const { $e } = useNuxtApp()

const { isMobileMode, user } = useGlobal()

const { isSharedBase } = useBase()

const { basesUser } = storeToRefs(useBases())

const { isUIAllowed } = useRoles()

const workflowStore = useWorkflowStore()

const { duplicateWorkflow } = workflowStore

const basesStore = useBases()

const { activeProjectId } = storeToRefs(basesStore)

const { activeWorkflowId } = storeToRefs(workflowStore)

const { meta: metaKey, control } = useMagicKeys()

const { showWorkflowPlanLimitExceededModal } = useEeConfig()

const { openWorkflowDescriptionDialog: _openWorkflowDescriptionDialog } = workflowStore

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
  return (basesUser.value.get(base.value?.id) || []).reduce((acc, user) => {
    acc[user.id] = user
    acc[user.email] = user
    return acc
  }, {} as Record<string, any>)
})

/** Debounce click handler, so we can potentially enable editing workflow name {@see onDblClick} */
const onClick = useDebounceFn(() => {
  emits('changeWorkflow', vModel.value)
}, 250)

const handleOnClick = () => {
  if (isEditing.value || isStopped.value) return

  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  if (cmdOrCtrl) {
    emits('changeWorkflow', vModel.value)
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

const isLoading = ref(false)

const duplicateWorkflowAction = async (workflow: WorkflowType) => {
  if (!activeProjectId.value) return

  if (showWorkflowPlanLimitExceededModal()) {
    isDropdownOpen.value = false
    return
  }

  try {
    isLoading.value = true
    await duplicateWorkflow(activeProjectId.value, workflow.id)
    isDropdownOpen.value = false
  } finally {
    isLoading.value = false
  }
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

/** Rename an workflow */
async function onRename() {
  isDropdownOpen.value = false
  if (!isEditing.value) return

  if (_title.value) {
    _title.value = _title.value.trim()
  }

  const isValid = props.onValidate({ ...vModel.value, title: _title.value! })

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

  emits('rename', vModel.value, originalTitle)

  onStopEdit()
}

const openWorkflowDescriptionDialog = (workflow: WorkflowType) => {
  isDropdownOpen.value = false

  _openWorkflowDescriptionDialog(workflow)
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

const isWorkflowDeleteDialogVisible = ref(false)

const deleteWorkflow = () => {
  isDropdownOpen.value = false
  isWorkflowDeleteDialogVisible.value = true
}
</script>

<template>
  <a-menu-item
    :data-testid="`view-sidebar-workflow-${vModel.title}`"
    class="nc-sidebar-node !rounded-md !px-0.75 !pl-2 !xs:(pl-2) !py-0.5 w-full transition-all ease-in duration-100 !min-h-7 !max-h-7 !my-0.5 select-none group text-nc-content-gray-subtle !flex !items-center hover:(!bg-nc-bg-gray-medium !text-nc-content-gray-subtle) cursor-pointer"
    @dblclick.stop="onDblClick"
    @click.prevent="handleOnClick"
  >
    <NcTooltip
      :disabled="isEditing || isDropdownOpen || !showWorkflowNodeTooltip"
      :overlay-inner-style="{ width: '240px' }"
      :tooltip-style="{ width: '240px', zIndex: '1049' }"
      placement="right"
      trigger="hover"
      :mouse-enter-delay="0.5"
    >
      <template #title>
        <div class="flex flex-col gap-3">
          <div>
            <div class="text-[10px] leading-[14px] text-nc-content-brand-hover uppercase mb-1">
              {{ $t('labels.workflowName') }}
            </div>
            <div class="text-small leading-[18px]">{{ vModel.title }}</div>
            <div class="mt-1 text-xs whitespace-pre-wrap break-words">{{ vModel.description }}</div>
          </div>
          <div v-if="vModel?.created_by && idUserMap[vModel?.created_by]">
            <div class="text-[10px] leading-[14px] text-nc-content-brand-hover uppercase mb-1">{{ $t('labels.createdBy') }}</div>
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
          @click.stop
          @dblclick.stop
        >
          <LazyGeneralEmojiPicker
            :key="props.workflow?.meta?.icon"
            :clearable="true"
            :emoji="props.workflow?.meta?.icon"
            :readonly="isMobileMode || !isUIAllowed('viewCreateOrEdit')"
            class="nc-workflow-icon"
            size="small"
            @emoji-selected="emits('selectIcon', $event)"
          >
            <template #default="{ isOpen }">
              <NcTooltip
                class="flex"
                placement="topLeft"
                hide-on-click
                :disabled="isOpen || isMobileMode || !isUIAllowed('viewCreateOrEdit')"
              >
                <template #title>
                  {{ $t('general.changeIcon') }}
                </template>

                <GeneralIcon
                  :class="activeWorkflowId === vModel.id ? '!text-brand-600/85' : '!text-gray-600/75'"
                  class="w-4 text-nc-content-gray-subtle !text-[16px]"
                  icon="ncAutomation"
                />
              </NcTooltip>
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
                    @click="onRenameMenuClick(workflow)"
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
                    @click="duplicateWorkflowAction(workflow)"
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
    <DlgWorkflowDelete v-if="workflow.id" v-model:visible="isWorkflowDeleteDialogVisible" :workflow="workflow" />
  </a-menu-item>
</template>
