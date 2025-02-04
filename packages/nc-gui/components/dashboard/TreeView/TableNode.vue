<script lang="ts" setup>
import { type BaseType, type TableType, ViewTypes } from 'nocodb-sdk'

import type { SidebarTableNode } from '~/lib/types'

const props = withDefaults(
  defineProps<{
    base: BaseType
    table: SidebarTableNode
    sourceIndex: number
  }>(),
  { sourceIndex: 0 },
)

const { base, table, sourceIndex } = toRefs(props)

const { openTable: _openTable } = useTableNew({
  baseId: base.value.id!,
})

const route = useRoute()

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const tabStore = useTabs()
const { updateTab } = tabStore

const { $e, $api } = useNuxtApp()

const { isMysql, isMssql, isPg } = useBase()

useTableNew({
  baseId: base.value.id!,
})

const { meta: metaKey, control } = useMagicKeys()

const baseRole = inject(ProjectRoleInj)
provide(SidebarTableInj, table)

const {
  setMenuContext,
  handleTableRename,
  openTableDescriptionDialog: _openTableDescriptionDialog,
  duplicateTable: _duplicateTable,
  tableRenameId,
} = inject(TreeViewInj)!

const { loadViews: _loadViews, navigateToView, duplicateView } = useViewsStore()
const { activeView, activeViewTitleOrId, viewsByTable } = storeToRefs(useViewsStore())
const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { refreshCommandPalette } = useCommandPalette()

// todo: temp
const { baseTables } = storeToRefs(useTablesStore())
const tables = computed(() => baseTables.value.get(base.value.id!) ?? [])

const openedTableId = computed(() => route.params.viewId)

const source = computed(() => {
  return base.value?.sources?.[sourceIndex.value]
})

const isTableDeleteDialogVisible = ref(false)

const isOptionsOpen = ref(false)

const input = ref<HTMLInputElement>()

/** Is editing the table name enabled */
const isEditing = ref(false)

/** Helper to check if editing was disabled before the view navigation timeout triggers */
const isStopped = ref(false)

const useForm = Form.useForm

const formState = reactive({
  title: '',
})

const validators = computed(() => {
  return {
    title: [
      validateTableName,
      {
        validator: (rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            let tableNameLengthLimit = 255
            if (isMysql(source.value?.id)) {
              tableNameLengthLimit = 64
            } else if (isPg(source.value?.id)) {
              tableNameLengthLimit = 63
            } else if (isMssql(source.value?.id)) {
              tableNameLengthLimit = 128
            }
            const basePrefix = base?.value?.prefix || ''
            if ((basePrefix + value).length > tableNameLengthLimit) {
              return reject(new Error(`Table name exceeds ${tableNameLengthLimit} characters`))
            }
            resolve()
          })
        },
      },
      {
        validator: (rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            if (
              !(tables?.value || []).every(
                (t) => t.id === table.value.id || t.title.toLowerCase() !== (value?.trim() || '').toLowerCase(),
              )
            ) {
              return reject(new Error('Duplicate table alias'))
            }
            resolve()
          })
        },
      },
    ],
  }
})

const { validate } = useForm(formState, validators)

const setIcon = async (icon: string, table: TableType) => {
  try {
    table.meta = {
      ...((table.meta as object) || {}),
      icon,
    }
    tables.value.splice(tables.value.indexOf(table), 1, { ...table })

    updateTab({ id: table.id }, { meta: table.meta })

    await $api.dbTable.update(table.id as string, {
      meta: table.meta,
    })

    $e('a:table:icon:navdraw', { icon })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// Todo: temp

const { isSharedBase } = useBase()
// const isMultiBase = computed(() => base.sources && base.sources.length > 1)

const canUserEditEmote = computed(() => {
  return isUIAllowed('tableIconEdit', { roles: baseRole?.value })
})

const isExpanded = ref(false)
const isLoading = ref(false)

const onExpand = async () => {
  if (isExpanded.value) {
    isExpanded.value = false
    return
  }

  isLoading.value = true
  try {
    await _loadViews({ tableId: table.value.id, ignoreLoading: true })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
    isExpanded.value = true
  }
}

const onOpenTable = async () => {
  if (isEditing.value || isStopped.value) return

  if (isMac() ? metaKey.value : control.value) {
    await _openTable(table.value, true)
    return
  }

  isLoading.value = true
  try {
    await _openTable(table.value)

    if (isMobileMode.value) {
      isLeftSidebarOpen.value = false
    }
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
    isExpanded.value = true
  }
}

watch(
  () => activeView.value?.id,
  () => {
    if (!activeView.value) return

    if (activeView.value?.fk_model_id === table.value?.id) {
      isExpanded.value = true
    }
  },
  {
    immediate: true,
  },
)

const isTableOpened = computed(() => {
  return openedTableId.value === table.value?.id && (activeView.value?.is_default || !activeViewTitleOrId.value)
})

let tableTimeout: NodeJS.Timeout

watch(openedTableId, () => {
  if (tableTimeout) {
    clearTimeout(tableTimeout)
  }

  if (table.value.id !== openedTableId.value && isExpanded.value) {
    const views = viewsByTable.value.get(table.value.id!)?.filter((v) => !v.is_default) ?? []

    if (views.length) return

    tableTimeout = setTimeout(() => {
      if (isExpanded.value) {
        isExpanded.value = false
      }
      clearTimeout(tableTimeout)
    }, 10000)
  }
})

const duplicateTable = (table: SidebarTableNode) => {
  isOptionsOpen.value = false
  _duplicateTable(table)
}

const focusInput = () => {
  setTimeout(() => {
    input.value?.focus()
    input.value?.select()
  })
}

const onRenameMenuClick = (table: SidebarTableNode) => {
  if (isMobileMode.value || !isUIAllowed('tableRename', { roles: baseRole?.value, source: source.value })) return

  isOptionsOpen.value = false

  if (!isEditing.value) {
    isEditing.value = true
    formState.title = table.title

    nextTick(() => {
      focusInput()
    })
  }
}

watch(
  tableRenameId,
  (n, o) => {
    if (n === o) return

    if (n && `${table.value.id}:${source.value?.id}` === tableRenameId.value) {
      onRenameMenuClick(table.value)
    } else {
      isEditing.value = false
      onCancel()
    }
  },
  { immediate: true },
)

const openTableDescriptionDialog = (table: SidebarTableNode) => {
  isOptionsOpen.value = false
  _openTableDescriptionDialog(table)
}

const deleteTable = () => {
  isOptionsOpen.value = false
  isTableDeleteDialogVisible.value = true
}
const isOnDuplicateLoading = ref<boolean>(false)

async function onDuplicate() {
  isOnDuplicateLoading.value = true

  // Load views if not loaded
  if (!viewsByTable.value.get(table.value.id as string)) {
    await _openTable(table.value, undefined, false)
  }

  const views = viewsByTable.value.get(table.value.id as string)
  const defaultView = views?.find((v) => v.is_default) || views?.[0]

  if (defaultView) {
    const view = await duplicateView(defaultView)

    refreshCommandPalette()

    await _loadViews({
      force: true,
      tableId: table.value!.id!,
    })

    if (view) {
      navigateToView({
        view,
        tableId: table.value!.id!,
        baseId: base.value.id!,
        hardReload: view.type === ViewTypes.FORM,
      })

      $e('a:view:create', { view: view.type, sidebar: true })
    }
  }

  isOnDuplicateLoading.value = false
  isOptionsOpen.value = false
}

// TODO: Should find a way to render the components without using the `nextTick` function
const refreshViews = async () => {
  isExpanded.value = false
  await nextTick()
  isExpanded.value = true
}

/** Cancel renaming view */
function onCancel() {
  if (!isEditing.value) return

  onStopEdit()
}

/** Stop editing view name, timeout makes sure that view navigation (click trigger) does not pick up before stop is done */
function onStopEdit() {
  isStopped.value = true
  isEditing.value = false
  formState.title = ''
  tableRenameId.value = ''

  setTimeout(() => {
    isStopped.value = false
  }, 250)
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

const validateTitle = async () => {
  try {
    await validate()
    return true
  } catch (e: any) {
    console.log('e', e)
    const errMsg = e.errorFields?.[0]?.errors?.[0]

    if (errMsg) {
      message.error(errMsg)
    }
  }
}

/** Rename a table */
async function onRename() {
  if (!isEditing.value) return

  if (!formState.title?.trim() || table.value.title === formState.title) {
    onCancel()
    return
  }

  const isValid = await validateTitle()

  if (!isValid) {
    onCancel()
    return
  }

  const originalTitle = table.value.title

  table.value.title = formState.title.trim() || ''

  const updateTitle = (title: string) => {
    table.value.title = title
  }

  handleTableRename(table.value, formState.title, originalTitle, updateTitle)

  onStopEdit()

  onCancel()
}
</script>

<template>
  <div
    class="nc-tree-item nc-table-node-wrapper text-sm select-none w-full"
    :data-order="table.order"
    :data-id="table.id"
    :data-table-id="table.id"
    :class="[`nc-base-tree-tbl nc-base-tree-tbl-${table.title?.replaceAll(' ', '')}`]"
    :data-active="openedTableId === table.id"
  >
    <div class="flex items-center py-0.5">
      <div
        v-e="['a:table:open']"
        class="flex-none flex-1 table-context flex items-center gap-1 h-full nc-tree-item-inner nc-sidebar-node pr-0.75 mb-0.25 rounded-md h-7 w-full group cursor-pointer hover:bg-gray-200"
        :class="{
          'hover:bg-gray-200': openedTableId !== table.id,
          'pl-13.5': sourceIndex !== 0,
          'pl-7.5 xs:(pl-6)': sourceIndex === 0,
          '!bg-primary-selected': isTableOpened,
        }"
        :data-testid="`nc-tbl-side-node-${table.title}`"
        @contextmenu="setMenuContext('table', table)"
        @click="onOpenTable"
      >
        <div class="flex flex-row h-full items-center">
          <div class="flex w-auto" :data-testid="`tree-view-table-draggable-handle-${table.title}`">
            <GeneralLoader v-if="table.isViewsLoading" class="flex items-center w-6 h-full !text-gray-600" />
            <div
              v-else
              v-e="['c:table:emoji-picker']"
              class="flex items-center nc-table-icon"
              :class="{
                'pointer-events-none': !canUserEditEmote,
              }"
              @click.stop
            >
              <LazyGeneralEmojiPicker
                :key="table.meta?.icon"
                :emoji="table.meta?.icon"
                size="small"
                :readonly="!canUserEditEmote || isMobileMode"
                @emoji-selected="setIcon($event, table)"
              >
                <template #default>
                  <NcTooltip class="flex" placement="topLeft" hide-on-click :disabled="!canUserEditEmote">
                    <template #title>
                      {{ $t('general.changeIcon') }}
                    </template>

                    <component
                      :is="iconMap.table"
                      v-if="table.type === 'table'"
                      class="w-4 text-sm"
                      :class="isTableOpened ? '!text-brand-600/85' : '!text-gray-600/75'"
                    />

                    <MdiEye v-else class="flex w-5 text-sm" :class="isTableOpened ? '!text-brand-600' : '!text-gray-600'" />
                  </NcTooltip>
                </template>
              </LazyGeneralEmojiPicker>
            </div>
          </div>
        </div>
        <a-form v-if="isEditing" :model="formState" name="rename-table-form" class="w-full" @finish.prevent>
          <a-input
            ref="input"
            v-model:value="formState.title"
            class="!bg-transparent !pr-1.5 !flex-1 mr-4 !rounded-md !h-6 animate-sidebar-node-input-padding"
            :class="{
              '!font-semibold !text-brand-600': isTableOpened,
            }"
            :style="{
              fontWeight: 'inherit',
            }"
            @blur="onRename"
            @keydown.stop="onKeyDown($event)"
          />
        </a-form>
        <NcTooltip
          v-else
          class="nc-tbl-title nc-sidebar-node-title text-ellipsis overflow-hidden select-none !flex-1"
          show-on-truncate-only
        >
          <template #title>{{ table.title }}</template>
          <span
            :class="isTableOpened ? 'text-brand-600 font-semibold' : 'text-gray-700'"
            :data-testid="`nc-tbl-title-${table.title}`"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            @dblclick.stop="onRenameMenuClick(table)"
          >
            {{ table.title }}
          </span>
        </NcTooltip>
        <div v-if="!isEditing" class="flex items-center">
          <NcTooltip v-if="table.description?.length" placement="bottom">
            <template #title>
              {{ table.description }}
            </template>

            <NcButton type="text" class="!hover:bg-transparent" size="xsmall">
              <GeneralIcon icon="info" class="!w-3.5 !h-3.5 nc-info-icon group-hover:opacity-100 text-gray-600 opacity-0" />
            </NcButton>
          </NcTooltip>

          <NcDropdown v-model:visible="isOptionsOpen" :trigger="['click']" @click.stop>
            <NcButton
              v-e="['c:table:option']"
              class="nc-sidebar-node-btn nc-tbl-context-menu text-gray-700 hover:text-gray-800"
              :class="{
                '!opacity-100 !inline-block': isOptionsOpen,
              }"
              data-testid="nc-sidebar-table-context-menu"
              type="text"
              size="xxsmall"
              @click.stop
            >
              <MdiDotsHorizontal class="!text-current" />
            </NcButton>

            <template #overlay>
              <NcMenu class="!min-w-62.5" :data-testid="`sidebar-table-context-menu-list-${table.title}`" variant="small">
                <NcMenuItemCopyId
                  v-if="table"
                  :id="table.id"
                  :tooltip="$t('labels.clickToCopyTableID')"
                  :label="
                    $t('labels.tableIdColon', {
                      tableId: table.id,
                    })
                  "
                />

                <NcMenuItem
                  v-if="
                    isUIAllowed('tableDescriptionEdit', { roles: baseRole, source }) &&
                    !isUIAllowed('tableRename', { roles: baseRole, source })
                  "
                  :data-testid="`sidebar-table-description-${table.title}`"
                  class="nc-table-description"
                  @click="openTableDescriptionDialog(table)"
                >
                  <div v-e="['c:table:update-description']" class="flex gap-2 items-center">
                    <!-- <GeneralIcon icon="ncAlignLeft" class="text-gray-700" /> -->
                    <GeneralIcon icon="ncAlignLeft" class="opacity-80" />
                    {{ $t('labels.editDescription') }}
                  </div>
                </NcMenuItem>

                <template
                  v-if="
                    !isSharedBase &&
                    (isUIAllowed('tableRename', { roles: baseRole, source }) ||
                      isUIAllowed('tableDelete', { roles: baseRole, source }))
                  "
                >
                  <NcDivider />
                  <NcMenuItem
                    v-if="isUIAllowed('tableRename', { roles: baseRole, source })"
                    :data-testid="`sidebar-table-rename-${table.title}`"
                    class="nc-table-rename"
                    @click="onRenameMenuClick(table)"
                  >
                    <div v-e="['c:table:rename']" class="flex gap-2 items-center">
                      <GeneralIcon icon="rename" class="opacity-80" />
                      {{ $t('general.rename') }} {{ $t('objects.table').toLowerCase() }}
                    </div>
                  </NcMenuItem>

                  <NcMenuItem
                    v-if="isUIAllowed('tableDescriptionEdit', { roles: baseRole, source })"
                    :data-testid="`sidebar-table-description-${table.title}`"
                    class="nc-table-description"
                    @click="openTableDescriptionDialog(table)"
                  >
                    <div v-e="['c:table:update-description']" class="flex gap-2 items-center">
                      <!-- <GeneralIcon icon="ncAlignLeft" class="text-gray-700" /> -->
                      <GeneralIcon icon="ncAlignLeft" class="opacity-80" />
                      {{ $t('labels.editDescription') }}
                    </div>
                  </NcMenuItem>

                  <NcMenuItem
                    v-if="
                      isUIAllowed('tableDuplicate', {
                        source,
                      }) &&
                      base.sources?.[sourceIndex] &&
                      (source?.is_meta || source?.is_local)
                    "
                    :data-testid="`sidebar-table-duplicate-${table.title}`"
                    @click="duplicateTable(table)"
                  >
                    <div v-e="['c:table:duplicate']" class="flex gap-2 items-center">
                      <GeneralIcon icon="duplicate" class="opacity-80" />
                      {{ $t('general.duplicate') }} {{ $t('objects.table').toLowerCase() }}
                    </div>
                  </NcMenuItem>
                  <NcDivider />

                  <NcMenuItem @click="onDuplicate">
                    <GeneralLoader v-if="isOnDuplicateLoading" size="regular" />
                    <GeneralIcon v-else class="nc-view-copy-icon opacity-80" icon="duplicate" />
                    {{
                      $t('general.duplicateEntity', {
                        entity: $t('title.defaultView').toLowerCase(),
                      })
                    }}
                  </NcMenuItem>

                  <NcDivider />
                  <NcMenuItem
                    v-if="isUIAllowed('tableDelete', { roles: baseRole, source })"
                    :data-testid="`sidebar-table-delete-${table.title}`"
                    class="!text-red-500 !hover:bg-red-50 nc-table-delete"
                    @click="deleteTable"
                  >
                    <div v-e="['c:table:delete']" class="flex gap-2 items-center">
                      <GeneralIcon icon="delete" class="opacity-80" />
                      {{ $t('general.delete') }} {{ $t('objects.table').toLowerCase() }}
                    </div>
                  </NcMenuItem>
                </template>
              </NcMenu>
            </template>
          </NcDropdown>

          <NcButton
            v-e="['c:table:toggle-expand']"
            type="text"
            size="xxsmall"
            class="nc-sidebar-node-btn nc-sidebar-expand text-gray-700 hover:text-gray-800"
            :class="{
              '!opacity-100 !visible': isOptionsOpen,
            }"
            @click.stop="onExpand"
          >
            <GeneralIcon
              icon="chevronRight"
              class="nc-sidebar-source-node-btns cursor-pointer transform transition-transform duration-200 !text-current text-[20px]"
              :class="{ '!rotate-90': isExpanded }"
            />
          </NcButton>
        </div>
      </div>
    </div>
    <DlgTableDelete
      v-if="table.id && base?.id"
      v-model:visible="isTableDeleteDialogVisible"
      :table-id="table.id"
      :base-id="base.id"
    />

    <DashboardTreeViewViewsList v-if="isExpanded" :table-id="table.id" :base-id="base.id" @deleted="refreshViews" />
  </div>
</template>

<style scoped lang="scss">
.nc-tree-item {
  @apply relative after:(pointer-events-none content-[''] rounded absolute top-0 left-0  w-full h-full right-0 !bg-current transition duration-100 opacity-0);
}

.nc-tree-item svg {
  &:not(.nc-info-icon) {
    @apply text-primary text-opacity-60;
  }
}
</style>
