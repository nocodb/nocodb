<script lang="ts" setup>
import type { ViewSectionType } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'

interface Props {
  section: ViewSectionType
  isExpanded: boolean
  allExpanded: boolean
  allCollapsed: boolean
  isDefault?: boolean
}

interface Emits {
  (event: 'expand-toggle'): void
  (event: 'rename', title: string): void
  (event: 'delete'): void
  (event: 'open-menu'): void
  (event: 'expand-all'): void
  (event: 'collapse-all'): void
  (event: 'change-color', color: string): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { $e } = useNuxtApp()

const { t } = useI18n()

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const input = ref<HTMLInputElement>()

const isDropdownOpen = ref(false)

/** Is editing the section name enabled */
const isEditing = ref(false)

/** Helper to check if editing was disabled before navigation timeout triggers */
const isStopped = ref(false)

/** Original section title when editing the section name */
const _title = ref<string | undefined>()

const showSectionNodeTooltip = ref(true)

/** Debounce click handler for potential future use */
const onClick = useDebounceFn(() => {
  emits('expand-toggle')
}, 250)

const handleOnClick = () => {
  if (isEditing.value || isStopped.value) return
  onClick()
}

const focusInput = () => {
  setTimeout(() => {
    input.value?.focus()
    input.value?.select()
  })
}

/** Enable editing section name on dbl click */
function onDblClick() {
  if (props.isDefault || isMobileMode.value || !isUIAllowed('viewCreateOrEdit')) return

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = props.section.title
    $e('c:view-section:rename')

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

/** Rename section when enter is pressed */
function onKeyEnter(event: KeyboardEvent) {
  event.stopImmediatePropagation()
  event.preventDefault()

  onRename()
}

/** Disable renaming section when escape is pressed */
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
  if (isMobileMode.value || !isUIAllowed('viewCreateOrEdit')) return

  if (!isEditing.value) {
    // close dropdown when rename menu is clicked and show inline section rename input
    isDropdownOpen.value = false

    isEditing.value = true
    _title.value = props.section.title
    $e('c:view-section:rename')

    nextTick(() => {
      focusInput()
    })
  }
}

/** Rename a section */
async function onRename() {
  isDropdownOpen.value = false
  if (!isEditing.value) return

  if (_title.value) {
    _title.value = _title.value.trim()
  }

  if (props.section.title === '' || props.section.title?.trim() === _title.value) {
    onCancel()
    return
  }

  emits('rename', _title.value || '')

  onStopEdit()
}

/** Cancel renaming section */
function onCancel() {
  if (!isEditing.value) return

  onStopEdit()
}

/** Stop editing section name, timeout makes sure that section navigation does not pick up before stop is done */
function onStopEdit() {
  isStopped.value = true
  isEditing.value = false
  _title.value = ''

  setTimeout(() => {
    isStopped.value = false
  }, 250)
}

const onDelete = () => {
  isDropdownOpen.value = false
  emits('delete')
}

const onExpandAll = () => {
  isDropdownOpen.value = false
  emits('expand-all')
}

const onCollapseAll = () => {
  isDropdownOpen.value = false
  emits('collapse-all')
}

const DEFAULT_ICON_COLOR = '#3f8292'

const iconColor = computed(() => {
  return parseProp(props.section.meta)?.iconColor || DEFAULT_ICON_COLOR
})

const onChangeColor = (color: string) => {
  emits('change-color', color)
}
</script>

<template>
  <div
    class="nc-sidebar-node !min-h-7 !max-h-7 !my-0.5 select-none group text-nc-content-gray-subtle !flex !items-center hover:(!bg-nc-bg-gray-medium !text-nc-content-gray-subtle) cursor-pointer"
    :class="{
      '!pl-7.5 !xs:(pl-6.5)': true,
    }"
    :data-testid="`view-sidebar-section-${section.title}`"
    @click.prevent="handleOnClick"
  >
    <NcTooltip
      :tooltip-style="{ width: '240px', zIndex: '1049' }"
      :overlay-inner-style="{ width: '240px' }"
      :mouse-enter-delay="0.5"
      class="w-full"
      trigger="hover"
      placement="right"
      :disabled="isEditing || isDropdownOpen || !showSectionNodeTooltip || isMobileMode"
    >
      <template #title>
        <div class="flex flex-col gap-3">
          <div>
            <div class="text-[10px] leading-[14px] text-nc-content-brand-hover dark:text-nc-content-gray-muted uppercase mb-1">
              {{ $t('labels.sectionName') || 'Section Name' }}
            </div>
            <div class="text-small leading-[18px]">{{ section.title }}</div>
          </div>
        </div>
      </template>
      <div v-e="['a:view-section:open']" class="text-sm flex items-center w-full gap-1" data-testid="section-item">
        <div
          class="flex min-w-6"
          :data-testid="`view-sidebar-drag-handle-${section.title}`"
          @mouseenter="showSectionNodeTooltip = false"
          @mouseleave="showSectionNodeTooltip = true"
        >
          <NcButton type="text" size="xsmall" class="!px-0">
            <GeneralIcon
              :icon="isExpanded ? 'ncFolderOpen' : 'ncFolderClosed'"
              class="w-4 h-4"
              :style="{ color: iconColor }"
            />
          </NcButton>
        </div>

        <a-input
          v-if="isEditing"
          ref="input"
          v-model:value="_title"
          class="!bg-transparent !pr-1.5 !flex-1 mr-4 !rounded-md !h-6 animate-sidebar-node-input-padding"
          :style="{
            fontWeight: 'inherit',
          }"
          @blur="onRename"
          @keydown.stop="onKeyDown($event)"
        />
        <NcTooltip
          v-else
          class="nc-sidebar-node-title text-ellipsis overflow-hidden select-none max-w-full flex-1"
          show-on-truncate-only
          disabled
        >
          <template #title> {{ section.title }}</template>
          <div
            data-testid="sidebar-section-title"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            @dblclick.stop="onDblClick"
          >
            {{ section.title }}
          </div>
        </NcTooltip>

        <template v-if="!isEditing">
          <NcDropdown v-model:visible="isDropdownOpen" overlay-class-name="!rounded-lg">
            <NcButton
              v-e="['c:view-section:option']"
              type="text"
              size="xxsmall"
              class="nc-sidebar-node-btn invisible !group-hover:(visible opacity-100) nc-sidebar-section-node-context-btn"
              :class="{
                '!visible !opacity-100': isDropdownOpen,
              }"
              @click.stop="isDropdownOpen = !isDropdownOpen"
              @dblclick.stop
              @mouseenter="showSectionNodeTooltip = false"
              @mouseleave="showSectionNodeTooltip = true"
            >
              <GeneralIcon icon="threeDotHorizontal" class="text-xl w-4.75" />
            </NcButton>

            <template #overlay>
              <NcMenu class="!rounded-lg" variant="small">
                <NcMenuItem :disabled="allExpanded" @click="onExpandAll">
                  <GeneralIcon icon="ncFolderOpen" class="opacity-80" style="color: #3f8292" />
                  {{ $t('activity.kanban.expandAll') }}
                </NcMenuItem>
                <NcMenuItem :disabled="allCollapsed" @click="onCollapseAll">
                  <GeneralIcon icon="ncFolderClosed" class="opacity-80" style="color: #3f8292" />
                  {{ $t('activity.kanban.collapseAll') }}
                </NcMenuItem>
                <template v-if="!isDefault">
                  <NcDivider />
                  <div class="nc-section-color-picker-row flex items-center gap-2 px-2 py-1.5">
                    <GeneralIcon icon="ncFolderClosed" class="opacity-80 w-4 h-4 flex-none" :style="{ color: iconColor }" />
                    <span class="text-sm text-nc-content-gray-subtle flex-1">{{ $t('tooltip.changeIconColour') }}</span>
                  </div>
                  <div class="px-2 pb-1.5">
                    <GeneralColorPicker
                      :model-value="iconColor"
                      :colors="baseIconColors"
                      :is-new-design="true"
                      class="nc-section-icon-color-picker"
                      @input="onChangeColor"
                    />
                  </div>
                  <NcDivider v-if="isUIAllowed('viewCreateOrEdit')" />
                  <NcMenuItem
                    v-if="isUIAllowed('viewCreateOrEdit')"
                    @click="onRenameMenuClick"
                  >
                    <GeneralIcon icon="rename" class="opacity-80" />
                    {{
                      $t('general.renameEntity', {
                        entity: $t('objects.section').toLowerCase(),
                      })
                    }}
                  </NcMenuItem>
                  <NcDivider v-if="isUIAllowed('viewCreateOrEdit')" />
                  <NcMenuItem
                    v-if="isUIAllowed('viewCreateOrEdit')"
                    danger
                    @click="onDelete"
                  >
                    <GeneralIcon class="nc-view-delete-icon opacity-80" icon="delete" />
                    {{
                      $t('general.deleteEntity', {
                        entity: $t('objects.section').toLowerCase(),
                      })
                    }}
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
