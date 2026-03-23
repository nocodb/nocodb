<script lang="ts" setup>
import type { BoolType, ViewSectionType } from 'nocodb-sdk'

interface Props {
  section: ViewSectionType
  isExpanded: boolean
  allExpanded: boolean
  allCollapsed: boolean
  isDefault?: boolean
  isDefaultSource?: BoolType
  isDragging?: boolean
}

interface Emits {
  (event: 'expandToggle'): void
  (event: 'rename', title: string): void
  (event: 'delete'): void
  (event: 'openMenu'): void
  (event: 'expandAll'): void
  (event: 'collapseAll'): void
  (event: 'changeColor', color: string): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { $e } = useNuxtApp()

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
  if (isEditing.value || isStopped.value) return

  emits('expandToggle')
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
  emits('expandAll')
}

const onCollapseAll = () => {
  isDropdownOpen.value = false
  emits('collapseAll')
}

const DEFAULT_ICON_COLOR = '#3f8292'

const iconColor = computed(() => {
  return parseProp(props.section.meta)?.iconColor || DEFAULT_ICON_COLOR
})

const onChangeColor = (color: string) => {
  emits('changeColor', color)
}
</script>

<template>
  <div
    class="nc-sidebar-node !min-h-7 !max-h-7 !my-0.5 select-none group text-nc-content-gray-subtle text-bodyDefaultSm !flex !items-center hover:(!bg-nc-bg-gray-medium !text-nc-content-gray-subtle) cursor-pointer rounded-md pr-[3px]"
    :class="{
      '!pl-7.5': !!isDefaultSource,
      '!pl-14': !isDefaultSource,
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
      :disabled="isEditing || isDropdownOpen || !showSectionNodeTooltip || !!isMobileMode || isDragging"
    >
      <template #title>
        <div class="flex flex-col gap-3">
          <div>
            <div class="text-[10px] leading-[14px] text-nc-content-brand-hover dark:text-nc-content-gray-muted uppercase mb-1">
              {{ $t('labels.sectionName') }}
            </div>
            <div class="text-small leading-[18px]">{{ section.title }}</div>
          </div>
        </div>
      </template>
      <div
        v-e="['a:view-section:open']"
        class="text-bodyDefaultSm font-medium flex items-center w-full gap-1"
        data-testid="section-item"
      >
        <div
          class="flex min-w-6"
          :data-testid="`view-sidebar-drag-handle-${section.title}`"
          @mouseenter="showSectionNodeTooltip = false"
          @mouseleave="showSectionNodeTooltip = true"
        >
          <NcButton type="text" size="xxsmall" class="!px-0 !h-6 !w-6">
            <GeneralIcon :icon="isExpanded ? 'ncFolderOpen' : 'ncFolderClosed'" class="w-4 h-4" :style="{ color: iconColor }" />
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
          @dblclick.stop
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
                <NcMenuItem v-e="['c:view-section:expand-all']" :disabled="allExpanded" @click="onExpandAll">
                  <GeneralIcon icon="ncFolderOpen" class="opacity-80" />
                  {{ $t('activity.kanban.expandAll') }}
                </NcMenuItem>
                <NcMenuItem v-e="['c:view-section:collapse-all']" :disabled="allCollapsed" @click="onCollapseAll">
                  <GeneralIcon icon="ncFolderClosed" class="opacity-80" />
                  {{ $t('activity.kanban.collapseAll') }}
                </NcMenuItem>
                <template v-if="!isDefault">
                  <NcDivider />
                  <NcMenuItem class="!hover:bg-transparent !cursor-default !pb-0.5">
                    <GeneralIcon icon="ncPalette" class="opacity-80" />
                    {{ $t('labels.iconColour') }}
                  </NcMenuItem>
                  <div class="px-3.5 pb-0.5">
                    <GeneralColorPicker
                      :model-value="iconColor"
                      :colors="baseIconColors"
                      :is-new-design="true"
                      class="nc-section-icon-color-picker"
                      @input="onChangeColor"
                    />
                  </div>
                  <NcDivider v-if="isUIAllowed('viewCreateOrEdit')" />
                  <NcMenuItem v-if="isUIAllowed('viewCreateOrEdit')" @click="onRenameMenuClick">
                    <GeneralIcon icon="rename" class="opacity-80" />
                    {{
                      $t('general.renameEntity', {
                        entity: $t('objects.section').toLowerCase(),
                      })
                    }}
                  </NcMenuItem>
                  <NcDivider v-if="isUIAllowed('viewCreateOrEdit')" />
                  <NcMenuItem v-if="isUIAllowed('viewCreateOrEdit')" danger @click="onDelete">
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

<style lang="scss">
.nc-section-icon-color-picker {
  @apply !p-0;

  .color-picker-row {
    @apply !space-x-0.5 mb-1;

    & > div {
      @apply !p-0.5 !rounded !h-6;
    }
  }

  .color-selector {
    @apply !h-5 !w-5 !rounded;
  }

  .nc-more-colors-trigger {
    @apply !h-5 !w-5;

    .w-4 {
      @apply !w-3 !h-3;
    }
  }
}
</style>
