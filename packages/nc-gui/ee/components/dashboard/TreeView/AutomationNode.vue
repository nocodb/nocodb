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

const { isMobileMode } = useGlobal()

const { isSharedBase } = useBase()

const { isUIAllowed } = useRoles()

const { activeAutomationId } = storeToRefs(useAutomationStore())

const { meta: metaKey, control } = useMagicKeys()

const { openAutomationDescriptionDialog: _openAutomationDescriptionDialog } = inject(TreeViewInj)!

const input = ref<HTMLInputElement>()

const isDropdownOpen = ref(false)

const isEditing = ref(false)
/** Is editing the script name enabled */

/** Helper to check if editing was disabled before the script navigation timeout triggers */
const isStopped = ref(false)

/** Original script title when editing the script name */
const _title = ref<string | undefined>()

const showAutomationNodeTooltip = ref(true)

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

let scriptIdCopiedTimeout: NodeJS.Timeout

const isScriptIdCopied = ref(false)

const { copy } = useCopy()

const onScriptCopy = async () => {
  if (scriptIdCopiedTimeout) {
    clearTimeout(scriptIdCopiedTimeout)
  }

  try {
    await copy(vModel.value!.id!)
    isScriptIdCopied.value = true

    scriptIdCopiedTimeout = setTimeout(() => {
      isScriptIdCopied.value = false
      clearTimeout(scriptIdCopiedTimeout)
    }, 5000)
  } catch (e: any) {
    message.error(e.message)
  }
}

const isScriptDeleteDialogVisible = ref(false)

const deleteScript = () => {
  isDropdownOpen.value = false
  isScriptDeleteDialogVisible.value = true
}
</script>

<template>
  <a-menu-item
    class="nc-sidebar-node !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100 !pl-13.5 !xs:(pl-12) !min-h-7 !max-h-7 !my-0.5 select-none group text-gray-700 !flex !items-center hover:(!bg-gray-200 !text-gray-700) cursor-pointer"
    :data-testid="`view-sidebar-script-${vModel.title}`"
    @dblclick.stop="onDblClick"
    @click.prevent="handleOnClick"
  >
    <NcTooltip
      :tooltip-style="{ width: '240px', zIndex: '1049' }"
      :overlay-inner-style="{ width: '240px' }"
      trigger="hover"
      placement="right"
      :disabled="isEditing || isDropdownOpen || !showAutomationNodeTooltip"
    >
      <template #title>
        <div class="flex flex-col gap-3">
          <div class="text-[10px] leading-[14px] text-gray-300 uppercase mb-1">{{ $t('labels.scriptName') }}</div>
          <div class="text-small leading-[18px]">{{ vModel.title }}</div>
        </div>
      </template>
      <div v-e="['a:script:open']" class="text-sm flex items-center w-full gap-1" data-testid="script-item">
        <div
          v-e="['c:script:emoji-picker']"
          class="flex min-w-6"
          :data-testid="`view-sidebar-drag-handle-${vModel.title}`"
          @mouseenter="showAutomationNodeTooltip = false"
          @mouseleave="showAutomationNodeTooltip = true"
        >
          <LazyGeneralEmojiPicker
            class="nc-script-icon"
            size="small"
            :emoji="props.view?.meta?.icon"
            :clearable="true"
            :readonly="isMobileMode || !isUIAllowed('viewCreateOrEdit')"
            @emoji-selected="emits('selectIcon', $event)"
          >
            <template #default>
              <GeneralIcon icon="ncScript" class="w-4 text-nc-content-gray-subtle !text-[16px]" />
            </template>
          </LazyGeneralEmojiPicker>
        </div>

        <a-input
          v-if="isEditing"
          ref="input"
          v-model:value="_title"
          class="!bg-transparent !pr-1.5 !flex-1 mr-4 !rounded-md !h-6 animate-sidebar-node-input-padding"
          :class="{
            'font-semibold !text-brand-600': activeAutomationId === vModel.id,
          }"
          :style="{
            fontWeight: 'inherit',
          }"
          @blur="onRename"
          @keydown.stop="onKeyDown($event)"
        />
        <NcTooltip
          v-else
          class="nc-sidebar-node-title text-ellipsis overflow-hidden select-none w-full max-w-full"
          show-on-truncate-only
          disabled
        >
          <template #title> {{ vModel.title }}</template>
          <div
            data-testid="sidebar-script-title"
            :class="{
              'font-semibold text-brand-600': activeAutomationId === vModel.id,
            }"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
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
            <NcButton type="text" class="!hover:bg-transparent" size="xsmall">
              <GeneralIcon icon="info" class="!w-3.5 !h-3.5 nc-info-icon group-hover:opacity-100 text-gray-600 opacity-0" />
            </NcButton>
          </NcTooltip>
          <NcDropdown v-model:visible="isDropdownOpen" overlay-class-name="!rounded-lg">
            <NcButton
              v-e="['c:script:option']"
              type="text"
              size="xxsmall"
              class="nc-sidebar-node-btn invisible !group-hover:(visible opacity-100) nc-sidebar-script-node-context-btn"
              :class="{
                '!visible !opacity-100': isDropdownOpen,
              }"
              @click.stop="isDropdownOpen = !isDropdownOpen"
              @dblclick.stop
              @mouseenter="showAutomationNodeTooltip = false"
              @mouseleave="showAutomationNodeTooltip = true"
            >
              <GeneralIcon icon="threeDotHorizontal" class="text-xl w-4.75" />
            </NcButton>

            <template #overlay>
              <NcMenu variant="small" class="!min-w-62.5" :data-testid="`sidebar-script-context-menu-list-${script.title}`">
                <NcMenuItemCopyId
                  v-if="script"
                  :id="script.id"
                  :tooltip="$t('labels.clickToCopyScriptID')"
                  :label="
                    $t('labels.scriptIdColon', {
                      tableId: script.id,
                    })
                  "
                />

                <template v-if="!isSharedBase && isUIAllowed('scriptCreateOrEdit')">
                  <NcDivider />
                  <NcMenuItem
                    :data-testid="`sidebar-script-rename-${script.title}`"
                    class="nc-script-rename"
                    @click="onRenameMenuClick(script)"
                  >
                    <div v-e="['c:script:rename']" class="flex gap-2 items-center">
                      <GeneralIcon icon="rename" class="text-gray-700" />
                      {{ $t('general.rename') }} {{ $t('objects.script').toLowerCase() }}
                    </div>
                  </NcMenuItem>

                  <NcMenuItem
                    :data-testid="`sidebar-script-description-${script.title}`"
                    class="nc-script-description"
                    @click="openAutomationDescriptionDialog(script)"
                  >
                    <div v-e="['c:script:update-description']" class="flex gap-2 items-center">
                      <GeneralIcon icon="ncAlignLeft" class="text-gray-700" />
                      {{ $t('labels.editDescription') }}
                    </div>
                  </NcMenuItem>

                  <NcDivider />
                  <NcMenuItem
                    :data-testid="`sidebar-script-delete-${script.title}`"
                    class="!text-red-500 !hover:bg-red-50 nc-script-delete"
                    @click="deleteScript"
                  >
                    <div v-e="['c:table:delete']" class="flex gap-2 items-center">
                      <GeneralIcon icon="delete" />
                      {{ $t('general.delete') }} {{ $t('objects.script').toLowerCase() }}
                    </div>
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
