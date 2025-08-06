<script lang="ts" setup>
import { type DashboardType } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'

interface Props {
  dashboard: DashboardType
  onValidate: (dashboard: DashboardType) => boolean | string
}

interface Emits {
  (event: 'update:dashboard', data: Record<string, any>): void

  (event: 'selectIcon', icon: string): void

  (event: 'changeDashboard', dashboard: Record<string, any>): void

  (event: 'rename', dashboard: DashboardType, title: string | undefined): void

  (event: 'delete', dashboard: DashboardType): void

  (event: 'duplicate', dashboard: DashboardType): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'dashboard', emits) as WritableComputedRef<DashboardType>

const { $e } = useNuxtApp()

const { isMobileMode, user } = useGlobal()

const { isSharedBase } = useBase()

const { basesUser } = storeToRefs(useBases())

const { isUIAllowed } = useRoles()

const { activeDashboardId } = storeToRefs(useDashboardStore())

const { meta: metaKey, control } = useMagicKeys()

const { openDashboardDescriptionDialog: _openDashboardDescriptionDialog } = inject(TreeViewInj)!

const base = inject(ProjectInj, ref())

const input = ref<HTMLInputElement>()

const isDropdownOpen = ref(false)

const isEditing = ref(false)
/** Is editing the dashboard name enabled */

/** Helper to check if editing was disabled before the dashboard navigation timeout triggers */
const isStopped = ref(false)

/** Original dashboard title when editing the dashboard name */
const _title = ref<string | undefined>()

const showDashboardNodeTooltip = ref(true)

const idUserMap = computed(() => {
  return (basesUser.value.get(base.value?.id) || []).reduce((acc, user) => {
    acc[user.id] = user
    acc[user.email] = user
    return acc
  }, {} as Record<string, any>)
})

/** Debounce click handler, so we can potentially enable editing dashboard name {@see onDblClick} */
const onClick = useDebounceFn(() => {
  emits('changeDashboard', vModel.value)
}, 250)

const handleOnClick = () => {
  if (isEditing.value || isStopped.value) return

  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  if (cmdOrCtrl) {
    emits('changeDashboard', vModel.value)
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

/** Enable editing dashboard name on dbl click */
function onDblClick() {
  if (isMobileMode.value) return
  if (!isUIAllowed('dashboardEdit')) return

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = vModel.value.title
    $e('c:dashboard:rename')

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

/** Rename dashboard when enter is pressed */
function onKeyEnter(event: KeyboardEvent) {
  event.stopImmediatePropagation()
  event.preventDefault()

  onRename()
}

/** Disable renaming dashboard when escape is pressed */
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
  if (isMobileMode.value || !isUIAllowed('dashboardEdit')) return

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = vModel.value.title
    $e('c:dashboard:rename')

    nextTick(() => {
      focusInput()
    })
  }
}

/** Rename a dashboard */
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

const openDashboardDescriptionDialog = (dashboard: DashboardType) => {
  isDropdownOpen.value = false

  _openDashboardDescriptionDialog(dashboard)
}

/** Cancel renaming dashboard */
function onCancel() {
  if (!isEditing.value) return

  onStopEdit()
}

/** Stop editing dashboard name, timeout makes sure that dashboard navigation (click trigger) does not pick up before stop is done */
function onStopEdit() {
  isStopped.value = true
  isEditing.value = false
  _title.value = ''

  setTimeout(() => {
    isStopped.value = false
  }, 250)
}

const duplicateDashboard = (dashboard: DashboardType) => {
  isDropdownOpen.value = false

  emits('duplicate', dashboard)
}

const deleteDashboard = () => {
  isDropdownOpen.value = false
  emits('delete', vModel.value)
}
</script>

<template>
  <a-menu-item
    class="nc-sidebar-node !pl-2 !xs:(pl-2) !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100 !min-h-7 !max-h-7 !my-0.5 select-none group text-gray-700 !flex !items-center hover:(!bg-gray-200 !text-gray-700) cursor-pointer"
    :data-testid="`view-sidebar-dashboard-${vModel.title}`"
    @dblclick.stop="onDblClick"
    @click.prevent="handleOnClick"
  >
    <NcTooltip
      :tooltip-style="{ width: '240px', zIndex: '1049' }"
      :overlay-inner-style="{ width: '240px' }"
      trigger="hover"
      placement="right"
      :disabled="isEditing || isDropdownOpen || !showDashboardNodeTooltip"
    >
      <template #title>
        <div class="flex flex-col gap-3">
          <div>
            <div class="text-[10px] leading-[14px] text-gray-300 uppercase mb-1">{{ $t('labels.dashboardName') }}</div>
            <div class="text-small leading-[18px]">{{ vModel.title }}</div>
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
        </div>
      </template>
      <div v-e="['a:dashboard:open']" class="text-sm flex items-center w-full gap-1" data-testid="dashboard-item">
        <div
          v-e="['c:dashboard:emoji-picker']"
          class="flex min-w-6"
          :data-testid="`view-sidebar-drag-handle-${vModel.title}`"
          @mouseenter="showDashboardNodeTooltip = false"
          @mouseleave="showDashboardNodeTooltip = true"
        >
          <LazyGeneralEmojiPicker
            :key="props.dashboard?.meta?.icon"
            class="nc-dashboard-icon"
            size="small"
            :emoji="props.dashboard?.meta?.icon"
            :clearable="true"
            :readonly="isMobileMode || !isUIAllowed('dashboardEdit')"
            @emoji-selected="emits('selectIcon', $event)"
          >
            <template #default>
              <GeneralIcon
                icon="dashboards"
                :class="activeDashboardId === vModel.id ? '!text-brand-600/85' : '!text-gray-600/75'"
                class="w-4 text-nc-content-gray-subtle !text-[16px]"
              />
            </template>
          </LazyGeneralEmojiPicker>
        </div>

        <a-input
          v-if="isEditing"
          ref="input"
          v-model:value="_title"
          class="!bg-transparent !pr-1.5 !flex-1 mr-4 !rounded-md !h-6 animate-sidebar-node-input-padding"
          :class="{
            'font-semibold !text-brand-600': activeDashboardId === vModel.id,
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
            data-testid="sidebar-dashboard-title"
            :class="{
              'font-semibold text-brand-600': activeDashboardId === vModel.id,
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
            @mouseenter="showDashboardNodeTooltip = false"
            @mouseleave="showDashboardNodeTooltip = true"
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
              v-e="['c:dashboard:option']"
              type="text"
              size="xxsmall"
              class="nc-sidebar-node-btn invisible !group-hover:(visible opacity-100) nc-sidebar-dashboard-node-context-btn"
              :class="{
                '!visible !opacity-100': isDropdownOpen,
              }"
              @click.stop="isDropdownOpen = !isDropdownOpen"
              @dblclick.stop
              @mouseenter="showDashboardNodeTooltip = false"
              @mouseleave="showDashboardNodeTooltip = true"
            >
              <GeneralIcon icon="threeDotHorizontal" class="text-xl w-4.75" />
            </NcButton>

            <template #overlay>
              <NcMenu variant="small" class="!min-w-62.5" :data-testid="`sidebar-dashboard-context-menu-list-${dashboard.title}`">
                <NcMenuItemCopyId
                  v-if="dashboard?.id"
                  :id="dashboard.id"
                  :tooltip="$t('labels.clickToCopyDashboardID')"
                  :label="
                    $t('labels.dashboardIdColon', {
                      dashboardId: dashboard?.id,
                    })
                  "
                />
                <template v-if="!isSharedBase && isUIAllowed('dashboardEdit')">
                  <NcDivider />
                  <NcMenuItem
                    v-e="['c:dashboard:rename']"
                    :data-testid="`sidebar-dashboard-rename-${dashboard.title}`"
                    class="nc-dashboard-rename"
                    @click="onRenameMenuClick(dashboard)"
                  >
                    <GeneralIcon icon="rename" class="text-gray-700" />
                    {{ $t('general.rename') }} {{ $t('labels.dashboard').toLowerCase() }}
                  </NcMenuItem>
                  <NcMenuItem
                    v-e="['c:dashboard:update-description']"
                    :data-testid="`sidebar-dashboard-description-${dashboard.title}`"
                    class="nc-dashboard-description"
                    @click="openDashboardDescriptionDialog(dashboard)"
                  >
                    <GeneralIcon icon="ncAlignLeft" class="text-gray-700" />
                    {{ $t('labels.editDescription') }}
                  </NcMenuItem>

                  <NcDivider />

                  <NcMenuItem
                    v-if="isUIAllowed('dashboardDuplicate')"
                    :data-testid="`sidebar-dashboard-duplicate-${dashboard.title}`"
                    @click="duplicateDashboard(dashboard)"
                  >
                    <div v-e="['c:dashboard:duplicate']" class="flex gap-2 items-center">
                      <GeneralIcon icon="duplicate" class="opacity-80" />
                      {{ $t('general.duplicate') }} {{ $t('objects.dashboard').toLowerCase() }}
                    </div>
                  </NcMenuItem>
                  <NcDivider />

                  <NcMenuItem
                    v-e="['c:dashboard:delete']"
                    :data-testid="`sidebar-dashboard-delete-${dashboard.title}`"
                    class="!text-red-500 !hover:bg-red-50 nc-dashboard-delete"
                    @click="deleteDashboard"
                  >
                    <GeneralIcon icon="delete" />
                    {{ $t('general.delete') }} {{ $t('labels.dashboard').toLowerCase() }}
                  </NcMenuItem>
                </template>
              </NcMenu>
            </template>
          </NcDropdown>
        </template>
      </div>
    </NcTooltip>
  </a-menu-item>
</template>
