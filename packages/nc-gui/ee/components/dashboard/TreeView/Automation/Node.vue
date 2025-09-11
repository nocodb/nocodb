<script lang="ts" setup>
import { type ScriptType } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'

interface Props {
  script: ScriptType
  onValidate: (script: ScriptType) => boolean | string
}

interface Emits {
  (event: 'update:automation', data: Record<string, any>): void

  (event: 'selectIcon', icon: string): void

  (event: 'changeScript', script: Record<string, any>): void

  (event: 'rename', script: ScriptType, title: string | undefined): void

  (event: 'delete', script: ScriptType): void

  (event: 'openModal', data: { type: ScriptType }): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'script', emits) as WritableComputedRef<ScriptType & { created_by?: string }>

const { $e } = useNuxtApp()

const { isMobileMode, user } = useGlobal()

const { isSharedBase } = useBase()

const { basesUser } = storeToRefs(useBases())

const { isUIAllowed } = useRoles()

const automationStore = useAutomationStore()

const { duplicateAutomation } = automationStore

const basesStore = useBases()

const { activeProjectId } = storeToRefs(basesStore)

const { activeAutomationId } = storeToRefs(automationStore)

const { meta: metaKey, control } = useMagicKeys()

const { showScriptPlanLimitExceededModal } = useEeConfig()

const { openAutomationDescriptionDialog: _openAutomationDescriptionDialog } = inject(TreeViewInj)!

const base = inject(ProjectInj, ref())

const input = ref<HTMLInputElement>()

const isDropdownOpen = ref(false)

const isEditing = ref(false)
/** Is editing the script name enabled */

/** Helper to check if editing was disabled before the script navigation timeout triggers */
const isStopped = ref(false)

/** Original script title when editing the script name */
const _title = ref<string | undefined>()

const showAutomationNodeTooltip = ref(true)

const idUserMap = computed(() => {
  return (basesUser.value.get(base.value?.id) || []).reduce((acc, user) => {
    acc[user.id] = user
    acc[user.email] = user
    return acc
  }, {} as Record<string, any>)
})

/** Debounce click handler, so we can potentially enable editing script name {@see onDblClick} */
const onClick = useDebounceFn(() => {
  emits('changeScript', vModel.value)
}, 250)

const handleOnClick = () => {
  if (isEditing.value || isStopped.value) return

  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  if (cmdOrCtrl) {
    emits('changeScript', vModel.value)
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

const duplicateScript = async (script: ScriptType) => {
  if (!activeProjectId.value) return

  if (showScriptPlanLimitExceededModal()) {
    isDropdownOpen.value = false
    return
  }

  try {
    isLoading.value = true
    await duplicateAutomation(activeProjectId.value, script.id)
    isDropdownOpen.value = false
  } finally {
    isLoading.value = false
  }
}

/** Enable editing script name on dbl click */
function onDblClick() {
  if (isMobileMode.value) return
  if (!isUIAllowed('scriptCreateOrEdit')) return

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = vModel.value.title
    $e('c:script:rename')

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

/** Rename script when enter is pressed */
function onKeyEnter(event: KeyboardEvent) {
  event.stopImmediatePropagation()
  event.preventDefault()

  onRename()
}

/** Disable renaming script when escape is pressed */
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
  if (isMobileMode.value || !isUIAllowed('scriptCreateOrEdit')) return

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = vModel.value.title
    $e('c:script:rename')

    nextTick(() => {
      focusInput()
    })
  }
}

/** Rename a script */
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

const openAutomationDescriptionDialog = (script: ScriptType) => {
  isDropdownOpen.value = false

  _openAutomationDescriptionDialog(script)
}

/** Cancel renaming script */
function onCancel() {
  if (!isEditing.value) return

  onStopEdit()
}

/** Stop editing script name, timeout makes sure that script navigation (click trigger) does not pick up before stop is done */
function onStopEdit() {
  isStopped.value = true
  isEditing.value = false
  _title.value = ''

  setTimeout(() => {
    isStopped.value = false
  }, 250)
}

const isScriptDeleteDialogVisible = ref(false)

const deleteScript = () => {
  isDropdownOpen.value = false
  isScriptDeleteDialogVisible.value = true
}
</script>

<template>
  <a-menu-item
    :data-testid="`view-sidebar-script-${vModel.title}`"
    class="nc-sidebar-node !rounded-md !px-0.75 !pl-2 !xs:(pl-2) !py-0.5 w-full transition-all ease-in duration-100 !min-h-7 !max-h-7 !my-0.5 select-none group text-nc-content-gray-subtle !flex !items-center hover:(!bg-nc-bg-gray-medium !text-nc-content-gray-subtle) cursor-pointer"
    @dblclick.stop="onDblClick"
    @click.prevent="handleOnClick"
  >
    <NcTooltip
      :disabled="isEditing || isDropdownOpen || !showAutomationNodeTooltip"
      :overlay-inner-style="{ width: '240px' }"
      :tooltip-style="{ width: '240px', zIndex: '1049' }"
      placement="right"
      trigger="hover"
    >
      <template #title>
        <div class="flex flex-col gap-3">
          <div>
            <div class="text-[10px] leading-[14px] text-nc-content-brand-hover uppercase mb-1">{{ $t('labels.scriptName') }}</div>
            <div class="text-small leading-[18px]">{{ vModel.title }}</div>
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
      <div v-e="['a:script:open']" class="text-sm flex items-center w-full gap-1" data-testid="script-item">
        <div
          v-e="['c:script:emoji-picker']"
          :data-testid="`view-sidebar-drag-handle-${vModel.title}`"
          class="flex min-w-6"
          @mouseenter="showAutomationNodeTooltip = false"
          @mouseleave="showAutomationNodeTooltip = true"
          @click.stop
          @dblclick.stop
        >
          <LazyGeneralEmojiPicker
            :key="props.script?.meta?.icon"
            :clearable="true"
            :emoji="props.script?.meta?.icon"
            :readonly="isMobileMode || !isUIAllowed('viewCreateOrEdit')"
            class="nc-script-icon"
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
                  :class="
                    activeAutomationId === vModel.id ? '!text-nc-content-brand-disabled/85' : '!text-nc-content-gray-subtle2/75'
                  "
                  class="w-4 text-nc-content-gray-subtle !text-[16px]"
                  icon="ncScript"
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
            'font-semibold !text-nc-content-brand-disabled': activeAutomationId === vModel.id,
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
              'font-semibold text-nc-content-brand-disabled': activeAutomationId === vModel.id,
            }"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            data-testid="sidebar-script-title"
          >
            {{ vModel.title }}
          </div>
        </NcTooltip>
        <template v-if="!isEditing">
          <NcTooltip
            v-if="vModel.description?.length"
            placement="bottom"
            @mouseenter="showAutomationNodeTooltip = false"
            @mouseleave="showAutomationNodeTooltip = true"
          >
            <template #title>
              {{ vModel.description }}
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
              v-e="['c:script:option']"
              :class="{
                '!visible !opacity-100': isDropdownOpen,
              }"
              class="nc-sidebar-node-btn invisible !group-hover:(visible opacity-100) nc-sidebar-script-node-context-btn"
              size="xxsmall"
              type="text"
              @mouseenter="showAutomationNodeTooltip = false"
              @mouseleave="showAutomationNodeTooltip = true"
              @click.stop="isDropdownOpen = !isDropdownOpen"
              @dblclick.stop
            >
              <GeneralIcon class="text-xl w-4.75" icon="threeDotHorizontal" />
            </NcButton>

            <template #overlay>
              <NcMenu :data-testid="`sidebar-script-context-menu-list-${script.title}`" class="!min-w-62.5" variant="small">
                <NcMenuItemCopyId
                  v-if="script?.id"
                  :id="script.id"
                  :label="
                    $t('labels.scriptIdColon', {
                      scriptId: script?.id,
                    })
                  "
                  :tooltip="$t('labels.clickToCopyScriptID')"
                />
                <template v-if="!isSharedBase && isUIAllowed('scriptCreateOrEdit')">
                  <NcDivider />
                  <NcMenuItem
                    v-e="['c:script:rename']"
                    :data-testid="`sidebar-script-rename-${script.title}`"
                    class="nc-script-rename"
                    @click="onRenameMenuClick(script)"
                  >
                    <GeneralIcon class="text-nc-content-gray-subtle" icon="rename" />
                    {{ $t('general.rename') }} {{ $t('objects.script').toLowerCase() }}
                  </NcMenuItem>

                  <NcMenuItem
                    v-e="['c:script:update-description']"
                    :data-testid="`sidebar-script-description-${script.title}`"
                    class="nc-script-description"
                    @click="openAutomationDescriptionDialog(script)"
                  >
                    <GeneralIcon class="text-nc-content-gray-subtle" icon="ncAlignLeft" />
                    {{ $t('labels.editDescription') }}
                  </NcMenuItem>
                  <NcDivider />
                  <NcMenuItem
                    v-e="['c:script:duplicate']"
                    :data-testid="`sidebar-script-duplicate-${script.title}`"
                    class="nc-script-duplicate"
                    @click="duplicateScript(script)"
                  >
                    <GeneralLoader v-if="isLoading" />
                    <GeneralIcon v-else class="text-nc-content-gray-subtle" icon="duplicate" />
                    {{ $t('general.duplicate') }} {{ $t('objects.script').toLowerCase() }}
                  </NcMenuItem>
                  <NcDivider />
                  <NcMenuItem
                    v-e="['c:table:delete']"
                    :data-testid="`sidebar-script-delete-${script.title}`"
                    class="nc-script-delete"
                    danger
                    @click="deleteScript"
                  >
                    <GeneralIcon icon="delete" />
                    {{ $t('general.delete') }} {{ $t('objects.script').toLowerCase() }}
                  </NcMenuItem>
                </template>
              </NcMenu>
            </template>
          </NcDropdown>
        </template>
      </div>
    </NcTooltip>
    <DlgAutomationDelete v-if="script.id" v-model:visible="isScriptDeleteDialogVisible" :script="script" />
  </a-menu-item>
</template>
