<script lang="ts" setup>
import { type TableType, ViewLockType, type ViewType, type ViewTypes } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'
import { LockType, isDefaultBase as _isDefaultBase } from '#imports'

interface Props {
  view: ViewType
  table: TableType
  onValidate: (view: ViewType) => boolean | string
}

interface Emits {
  (event: 'update:view', data: Record<string, any>): void

  (event: 'selectIcon', icon: string): void

  (event: 'changeView', view: Record<string, any>): void

  (event: 'rename', view: ViewType, title: string | undefined): void

  (event: 'delete', view: ViewType): void

  (
    event: 'openModal',
    data: { type: ViewTypes; title?: string; copyViewId?: string; groupingFieldColumnId?: string; coverImageColumnId?: string },
  ): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'view', emits) as WritableComputedRef<
  ViewType & { alias?: string; is_default: boolean; created_by?: string }
>

const { $e } = useNuxtApp()

const { t } = useI18n()

const { isMobileMode, user } = useGlobal()

const { isUIAllowed } = useRoles()

const base = inject(ProjectInj, ref())

const { activeView } = storeToRefs(useViewsStore())

const { getMeta } = useMetas()

const { meta: metaKey, control } = useMagicKeys()

const { basesUser } = storeToRefs(useBases())

const table = computed(() => props.table)
const injectedTable = ref(table.value)

provide(ActiveViewInj, vModel)
provide(MetaInj, injectedTable)

const isLocked = inject(IsLockedInj, ref(false))

const isDefaultBase = computed(() => {
  if (base.value?.sources?.length === 1) return true

  const source = base.value?.sources?.find((b) => b.id === vModel.value.source_id)
  if (!source) return false

  return _isDefaultBase(source)
})

const { openViewDescriptionDialog: _openViewDescriptionDialog } = inject(TreeViewInj)!

const input = ref<HTMLInputElement>()

const isDropdownOpen = ref(false)

/** Is editing the view name enabled */
const isEditing = ref(false)

/** Helper to check if editing was disabled before the view navigation timeout triggers */
const isStopped = ref(false)

/** Original view title when editing the view name */
const _title = ref<string | undefined>()

const showViewNodeTooltip = ref(true)

const isViewOwner = computed(() => {
  return vModel.value?.owned_by === user.value?.id
})

const idUserMap = computed(() => {
  return (basesUser.value.get(base.value?.id) || []).reduce((acc, user) => {
    acc[user.id] = user
    acc[user.email] = user
    return acc
  }, {} as Record<string, any>)
})

/** Debounce click handler, so we can potentially enable editing view name {@see onDblClick} */
const onClick = useDebounceFn(() => {
  emits('changeView', vModel.value)
}, 250)

const handleOnClick = () => {
  if (isEditing.value || isStopped.value) return

  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  if (cmdOrCtrl) {
    emits('changeView', vModel.value)
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

/** Enable editing view name on dbl click */
function onDblClick() {
  if (isMobileMode.value || !isUIAllowed('viewCreateOrEdit')) return

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = vModel.value.title
    $e('c:view:rename', { view: vModel.value?.type })

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

/** Rename view when enter is pressed */
function onKeyEnter(event: KeyboardEvent) {
  event.stopImmediatePropagation()
  event.preventDefault()

  onRename()
}

/** Disable renaming view when escape is pressed */
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
    isEditing.value = true
    _title.value = vModel.value.title
    $e('c:view:rename', { view: vModel.value?.type })

    nextTick(() => {
      focusInput()
    })
  }
}

/** Rename a view */
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

const openViewDescriptionDialog = (view: ViewType) => {
  isDropdownOpen.value = false

  _openViewDescriptionDialog(view)
}

/** Cancel renaming view */
function onCancel() {
  if (!isEditing.value) return

  // vModel.value.title = _title || ''
  onStopEdit()
}

/** Stop editing view name, timeout makes sure that view navigation (click trigger) does not pick up before stop is done */
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

  emits('delete', vModel.value)
}

const viewModeInfo = computed(() => {
  switch (vModel.value?.lock_type) {
    case ViewLockType.Collaborative:
      return t(viewLockIcons[ViewLockType.Collaborative]?.title)
    case ViewLockType.Personal:
      return `${t(viewLockIcons[ViewLockType.Personal]?.title)} ${
        isViewOwner.value
          ? `(${t('general.you')})`
          : vModel.value?.owned_by && idUserMap.value[vModel.value.owned_by]
          ? `(${idUserMap.value[vModel.value.owned_by]?.display_name || idUserMap.value[vModel.value.owned_by]?.email})`
          : ''
      }`
    case ViewLockType.Locked:
      if (!vModel.value?.meta?.lockedByUserId || !idUserMap.value[vModel.value?.meta?.lockedByUserId]) {
        return t(viewLockIcons[ViewLockType.Locked]?.title)
      }

      return t('title.lockedByUser', {
        user:
          idUserMap.value[vModel.value?.meta?.lockedByUserId]?.id === user.value?.id
            ? t('general.you')
            : idUserMap.value[vModel.value?.meta?.lockedByUserId]?.display_name ||
              idUserMap.value[vModel.value?.meta?.lockedByUserId]?.email,
      })

    default:
      return t(viewLockIcons[ViewLockType.Collaborative]?.title)
  }
})

watch(isDropdownOpen, async () => {
  if (!isDropdownOpen.value) return

  injectedTable.value = (await getMeta(table.value.id!)) as any
})
</script>

<template>
  <a-menu-item
    class="nc-sidebar-node !min-h-7 !max-h-7 !my-0.5 select-none group text-gray-700 !flex !items-center hover:(!bg-gray-200 !text-gray-700) cursor-pointer"
    :class="{
      '!pl-13.5 !xs:(pl-12)': isDefaultBase,
      '!pl-19 ': !isDefaultBase,
    }"
    :data-testid="`view-sidebar-view-${vModel.alias || vModel.title}`"
    @click.prevent="handleOnClick"
  >
    <NcTooltip
      :tooltip-style="{ width: '240px', zIndex: '1049' }"
      :overlay-inner-style="{ width: '240px' }"
      trigger="hover"
      placement="right"
      :disabled="isEditing || isDropdownOpen || !showViewNodeTooltip"
    >
      <template #title>
        <div class="flex flex-col gap-3">
          <div>
            <div class="text-[10px] leading-[14px] text-gray-300 uppercase mb-1">{{ $t('labels.viewName') }}</div>
            <div class="text-small leading-[18px]">{{ vModel.alias || vModel.title }}</div>
          </div>

          <div v-if="vModel?.created_by && idUserMap[vModel?.created_by]">
            <div class="text-[10px] leading-[14px] text-gray-300 uppercase mb-1">{{ $t('labels.createdBy') }}</div>
            <div class="text-xs">
              {{
                idUserMap[vModel?.created_by]?.id === user?.id
                  ? $t('general.you')
                  : idUserMap[vModel?.created_by]?.display_name || idUserMap[vModel?.created_by]?.email
              }}
            </div>
          </div>
          <div>
            <div class="text-[10px] leading-[14px] text-gray-300 uppercase mb-1">{{ $t('labels.viewMode') }}</div>
            <div class="text-xs flex items-start gap-2">
              {{ viewModeInfo }}
            </div>
          </div>
        </div>
      </template>
      <div v-e="['a:view:open', { view: vModel.type }]" class="text-sm flex items-center w-full gap-1" data-testid="view-item">
        <div
          v-e="['c:view:emoji-picker']"
          class="flex min-w-6"
          :data-testid="`view-sidebar-drag-handle-${vModel.alias || vModel.title}`"
          @mouseenter="showViewNodeTooltip = false"
          @mouseleave="showViewNodeTooltip = true"
        >
          <LazyGeneralEmojiPicker
            class="nc-table-icon"
            :emoji="props.view?.meta?.icon"
            size="small"
            :clearable="true"
            :readonly="isMobileMode || !isUIAllowed('viewCreateOrEdit')"
            @emoji-selected="emits('selectIcon', $event)"
          >
            <template #default>
              <GeneralViewIcon :meta="props.view" class="nc-view-icon w-4 !text-[16px]"></GeneralViewIcon>
            </template>
          </LazyGeneralEmojiPicker>
        </div>

        <a-input
          v-if="isEditing"
          ref="input"
          v-model:value="_title"
          class="!bg-transparent !pr-1.5 !flex-1 mr-4 !rounded-md !h-6 animate-sidebar-node-input-padding"
          :class="{
            '!font-semibold !text-brand-600': activeView?.id === vModel.id,
          }"
          :style="{
            fontWeight: 'inherit',
          }"
          @blur="onRename"
          @keydown.stop="onKeyDown($event)"
        />
        <NcTooltip
          v-else
          class="nc-sidebar-node-title text-ellipsis overflow-hidden select-none max-w-full"
          :class="{
            'w-full': ![ViewLockType.Locked, ViewLockType.Personal].includes(vModel?.lock_type!)
          }"
          show-on-truncate-only
          disabled
        >
          <template #title> {{ vModel.alias || vModel.title }}</template>
          <div
            data-testid="sidebar-view-title"
            :class="{
              'font-semibold text-brand-600': activeView?.id === vModel.id,
            }"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            @dblclick.stop="onDblClick"
          >
            {{ vModel.alias || vModel.title }}
          </div>
        </NcTooltip>
        <div v-if="!isEditing && [LockType.Locked, ViewLockType.Personal].includes(vModel?.lock_type)" class="flex-1 flex">
          <component
            :is="viewLockIcons[vModel.lock_type].icon"
            class="ml-1 flex-none w-3.5 h-3.5"
            :class="{
              'text-brand-400': vModel?.lock_type === ViewLockType.Personal && isViewOwner,
              'text-gray-400': !(vModel?.lock_type === ViewLockType.Personal && isViewOwner),
            }"
          />
        </div>

        <template v-if="!isEditing && !isLocked">
          <NcTooltip
            v-if="vModel.description?.length"
            placement="bottom"
            @mouseenter="showViewNodeTooltip = false"
            @mouseleave="showViewNodeTooltip = true"
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
              v-e="['c:view:option']"
              type="text"
              size="xxsmall"
              class="nc-sidebar-node-btn invisible !group-hover:(visible opacity-100) nc-sidebar-view-node-context-btn"
              :class="{
                '!visible !opacity-100': isDropdownOpen,
              }"
              @click.stop="isDropdownOpen = !isDropdownOpen"
              @dblclick.stop
              @mouseenter="showViewNodeTooltip = false"
              @mouseleave="showViewNodeTooltip = true"
            >
              <GeneralIcon icon="threeDotHorizontal" class="text-xl w-4.75" />
            </NcButton>

            <template #overlay>
              <SmartsheetToolbarViewActionMenu
                :data-testid="`view-sidebar-view-actions-${vModel.alias || vModel.title}`"
                :view="vModel"
                :table="table"
                in-sidebar
                @close-modal="isDropdownOpen = false"
                @rename="onRenameMenuClick"
                @delete="onDelete"
                @description-update="openViewDescriptionDialog(vModel)"
              />
            </template>
          </NcDropdown>
        </template>
      </div>
    </NcTooltip>
  </a-menu-item>
</template>
