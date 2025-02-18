<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import Draggable from 'vuedraggable'
import tinycolor from 'tinycolor2'
import { ViewTypes, isVirtualCol } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

interface Attachment {
  url: string
}

const INFINITY_SCROLL_THRESHOLD = 100

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

// useProvideKanbanViewStore(meta, view)

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const reloadViewMetaHook = inject(ReloadViewMetaHookInj)

const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const isLocked = inject(IsLockedInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const expandedFormDlg = ref(false)

const expandedFormRow = ref<RowType>()

const expandedFormRowState = ref<Record<string, any>>()

provide(RowHeightInj, ref(1 as const))

const deleteStackVModel = ref(false)

const stackToBeDeleted = ref('')

const stackIdxToBeDeleted = ref(0)

const router = useRouter()

const route = router.currentRoute

const { getPossibleAttachmentSrc } = useAttachment()

const { metaColumnById } = useViewColumnsOrThrow(view, meta)

const {
  loadKanbanData,
  loadMoreKanbanData,
  loadKanbanMeta,
  kanbanMetaData,
  formattedData,
  updateOrSaveRow,
  updateKanbanMeta,
  addEmptyRow,
  groupingFieldColOptions,
  updateKanbanStackMeta,
  groupingField,
  groupingFieldColumn,
  countByStack,
  deleteStack,
  shouldScrollToRight,
  deleteRow,
  moveHistory,
  addNewStackId,
  removeRowFromUncategorizedStack,
  uncategorizedStackId,
} = useKanbanViewStoreOrThrow()

const { isViewDataLoading } = storeToRefs(useViewsStore())

const { isUIAllowed } = useRoles()

const { appInfo, isMobileMode } = useGlobal()

const { addUndo, defineViewScope } = useUndoRedo()

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(true))

const hasEditPermission = computed(() => isUIAllowed('dataEdit'))

const fields = inject(FieldsInj, ref([]))

const fieldsWithoutDisplay = computed(() => fields.value.filter((f) => !isPrimary(f)))

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

const coverImageColumn: any = computed(() =>
  meta.value?.columnsById
    ? meta.value.columnsById[kanbanMetaData.value?.fk_cover_image_col_id as keyof typeof meta.value.columnsById]
    : {},
)

const coverImageObjectFitClass = computed(() => {
  const fk_cover_image_object_fit = parseProp(kanbanMetaData.value?.meta)?.fk_cover_image_object_fit || CoverImageObjectFit.FIT

  if (fk_cover_image_object_fit === CoverImageObjectFit.FIT) return '!object-contain'
  if (fk_cover_image_object_fit === CoverImageObjectFit.COVER) return '!object-cover'
})

const isRequiredGroupingFieldColumn = computed(() => {
  return !!groupingFieldColumn.value?.rqd
})

const kanbanContainerRef = ref()

const selectedStackTitle = ref('')

reloadViewDataHook?.on(async () => {
  await loadKanbanMeta()
  await loadKanbanData()
})

const attachments = (record: any): Attachment[] => {
  if (!coverImageColumn.value?.title || !record.row[coverImageColumn.value.title]) return []

  try {
    const att =
      typeof record.row[coverImageColumn.value.title] === 'string'
        ? JSON.parse(record.row[coverImageColumn.value.title])
        : record.row[coverImageColumn.value.title]

    if (Array.isArray(att)) {
      return att
        .flat()
        .map((a) => (typeof a === 'string' ? JSON.parse(a) : a))
        .filter((a) => a && !Array.isArray(a) && typeof a === 'object' && Object.keys(a).length)
    }

    return []
  } catch (e) {
    return []
  }
}

const reloadAttachments = ref(false)

reloadViewMetaHook?.on(async () => {
  await loadKanbanMeta()

  reloadAttachments.value = true

  nextTick(() => {
    reloadAttachments.value = false
  })
})

const expandForm = (row: RowType, state?: Record<string, any>) => {
  const rowId = extractPkFromRow(row.row, meta.value!.columns!)
  expandedFormRowState.value = state
  if (rowId && !isPublic.value) {
    expandedFormRow.value = undefined

    router.push({
      query: {
        ...route.value.query,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormDlg.value = true
  }
}

const _contextMenu = ref(false)

const contextMenu = computed({
  get: () => _contextMenu.value,
  set: (val) => {
    if (hasEditPermission.value) {
      _contextMenu.value = val
    }
  },
})

const contextMenuTarget = ref<RowType | null>(null)

const showContextMenu = (e: MouseEvent, target?: RowType) => {
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!route.value.query.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...route.value.query,
          rowId: undefined,
        },
      })
  },
})

const expandFormClick = async (e: MouseEvent, row: RowType) => {
  const target = e.target as HTMLElement
  if (target.closest('.arrow') || target.closest('.slick-dots')) return
  if (e.target as HTMLElement) {
    expandForm(row)
  }
}

/** Block dragging the stack to first index (reserved for uncategorized) **/
function onMoveCallback(event: { draggedContext: { futureIndex: number } }) {
  if (event.draggedContext.futureIndex === 0) {
    return false
  }
}

async function onMoveStack(event: any, undo = false) {
  if (event.moved) {
    const { oldIndex, newIndex } = event.moved
    const { fk_grp_col_id, meta: stack_meta } = kanbanMetaData.value
    groupingFieldColOptions.value[oldIndex].order = newIndex
    groupingFieldColOptions.value[newIndex].order = oldIndex
    const stackMetaObj = parseProp(stack_meta) || {}
    stackMetaObj[fk_grp_col_id as string] = groupingFieldColOptions.value
    await updateKanbanMeta({
      meta: stackMetaObj,
    })
    if (!undo) {
      addUndo({
        undo: {
          fn: async (e: any) => {
            const temp = groupingFieldColOptions.value.splice(e.moved.newIndex, 1)
            groupingFieldColOptions.value.splice(e.moved.oldIndex, 0, temp[0])
            await onMoveStack(e, true)
          },
          args: [{ moved: { oldIndex, newIndex } }],
        },
        redo: {
          fn: async (e: any) => {
            const temp = groupingFieldColOptions.value.splice(e.moved.oldIndex, 1)
            groupingFieldColOptions.value.splice(e.moved.newIndex, 0, temp[0])
            await onMoveStack(e, true)
          },
          args: [{ moved: { oldIndex, newIndex } }, true],
        },
        scope: defineViewScope({ view: view.value }),
      })
    }
  }
}

async function onMove(event: any, stackKey: string) {
  if (event.added) {
    const ele = event.added.element

    moveHistory.value.unshift({
      op: 'added',
      pk: extractPkFromRow(event.added.element.row, meta.value!.columns!),
      index: event.added.newIndex,
      stack: stackKey,
    })

    ele.row[groupingField.value] = stackKey
    countByStack.value.set(stackKey, countByStack.value.get(stackKey)! + 1)
    await updateOrSaveRow(ele)
  } else if (event.removed) {
    countByStack.value.set(stackKey, countByStack.value.get(stackKey)! - 1)
    moveHistory.value.unshift({
      op: 'removed',
      pk: extractPkFromRow(event.removed.element.row, meta.value!.columns!),
      index: event.removed.oldIndex,
      stack: stackKey,
    })
  }
}

const kanbanListScrollHandler = useDebounceFn(async (e: any) => {
  if (!e.target) return

  if (e.target.scrollTop + e.target.clientHeight + INFINITY_SCROLL_THRESHOLD >= e.target.scrollHeight) {
    const stackTitle = e.target.getAttribute('data-stack-title')
    const pageSize = appInfo.value.defaultLimit || 25
    const stack = formattedData.value.get(stackTitle)

    if (stack && (countByStack.value.get(stackTitle) === undefined || stack.length < countByStack.value.get(stackTitle)!)) {
      const page = Math.ceil(stack.length / pageSize)

      await loadMoreKanbanData(stackTitle, {
        offset:
          page * pageSize > countByStack.value.get(stackTitle)! || page * pageSize > stack.length
            ? (page - 1) * pageSize
            : page * pageSize,
      })
    }
  }
})

const kanbanListRef: VNodeRef = (kanbanListElement) => {
  if (kanbanListElement) {
    ;(kanbanListElement as HTMLElement).removeEventListener('scroll', kanbanListScrollHandler)
    ;(kanbanListElement as HTMLElement).addEventListener('scroll', kanbanListScrollHandler)
  }
}

const handleDeleteStackClick = (stackTitle: string, stackIdx: number) => {
  deleteStackVModel.value = true
  stackToBeDeleted.value = stackTitle
  stackIdxToBeDeleted.value = stackIdx
}

const handleDeleteStackConfirmClick = async () => {
  await deleteStack(stackToBeDeleted.value, stackIdxToBeDeleted.value)
  deleteStackVModel.value = false
}

const handleCollapseStack = async (stackIdx: number) => {
  groupingFieldColOptions.value[stackIdx].collapsed = !groupingFieldColOptions.value[stackIdx].collapsed
  if (!isPublic.value) {
    await updateKanbanStackMeta()
  }
}

const handleCellClick = (col, event) => {
  if (isButton(col)) {
    event.stopPropagation()
  }
}

const handleCollapseAllStack = async () => {
  groupingFieldColOptions.value.forEach((stack) => {
    if (stack.id !== addNewStackId && !stack.collapsed) {
      stack.collapsed = true
    }
  })

  if (!isPublic.value) {
    await updateKanbanStackMeta()
  }
}
const handleExpandAllStack = async () => {
  groupingFieldColOptions.value.forEach((stack) => {
    if (stack.id !== addNewStackId && stack.collapsed) {
      stack.collapsed = false
    }
  })

  if (!isPublic.value) {
    await updateKanbanStackMeta()
  }
}

const openNewRecordFormHookHandler = async () => {
  const newRow = await addEmptyRow()
  // preset the grouping field value
  newRow.row = {
    [groupingField.value]: selectedStackTitle.value === '' ? null : selectedStackTitle.value,
  }
  // increase total count by 1
  countByStack.value.set(null, countByStack.value.get(null)! + 1)
  // open the expanded form
  expandForm(newRow)
}

openNewRecordFormHook?.on(openNewRecordFormHookHandler)

// remove openNewRecordFormHookHandler before unmounting
// so that it won't be triggered multiple times
onBeforeUnmount(() => openNewRecordFormHook.off(openNewRecordFormHookHandler))

// reset context menu target on hide
watch(contextMenu, () => {
  if (!contextMenu.value) {
    contextMenuTarget.value = null
  }
})

watch(
  view,
  async (nextView) => {
    if (nextView?.type === ViewTypes.KANBAN) {
      isViewDataLoading.value = true

      try {
        // load kanban meta
        await loadKanbanMeta()

        isViewDataLoading.value = false

        // load kanban data
        await loadKanbanData()

        // horizontally scroll to the end of the kanban container
        // when a new option is added within kanban view
        nextTick(() => {
          if (shouldScrollToRight.value && kanbanContainerRef.value) {
            kanbanContainerRef.value.scrollTo({
              left: kanbanContainerRef.value.scrollWidth,
              behavior: 'smooth',
            })
            // reset shouldScrollToRight
            shouldScrollToRight.value = false
          }
        })
      } catch (error) {
        console.error(error)
        isViewDataLoading.value = false
      }
    }
  },
  {
    immediate: true,
  },
)

const getRowId = (row: RowType) => {
  const pk = extractPkFromRow(row.row, meta.value!.columns!)
  return pk ? `row-${pk}` : ''
}

const hideEmptyStack = computed<boolean>(() => parseProp(kanbanMetaData.value?.meta).hide_empty_stack || false)

const addNewStackObj = {
  id: addNewStackId,
}

const isRenameOrNewStack = ref(null)

const compareStack = (stack: any, stack2?: any) => stack?.id && stack2?.id && stack.id === stack2.id

const isSavingStack = ref(null)

const handleSubmitRenameOrNewStack = async (loadMeta: boolean, stack?: any, stackIdx?: number) => {
  isSavingStack.value = isRenameOrNewStack.value
  isRenameOrNewStack.value = null

  if (stack && stack?.title && stack?.color && stackIdx !== undefined) {
    groupingFieldColOptions.value[stackIdx].title = stack.title
    groupingFieldColOptions.value[stackIdx].color = stack.color
  }

  if (loadMeta) {
    await loadKanbanMeta()
  }

  isSavingStack.value = null
}

const draggableStackFilter = (event: Event) => {
  return event.target?.closest('.not-draggable')
  // || isTouchEvent(event) // allow drag and drop for touch devices for now
}

const draggableCardFilter = (event: Event, target: HTMLElement) => {
  const eventTarget = event.target as HTMLElement | null
  const closestNotDraggable = eventTarget?.closest('.not-draggable')

  return !!(
    eventTarget &&
    target.contains(eventTarget) &&
    closestNotDraggable &&
    (target.contains(closestNotDraggable) || closestNotDraggable === target)
  )
  // || isTouchEvent(event) // allow drag and drop for touch devices for now
}
</script>

<template>
  <div
    class="flex flex-col w-full bg-gray-50 h-full"
    data-testid="nc-kanban-wrapper"
    :style="{
      minHeight: 'calc(100% - var(--topbar-height))',
    }"
  >
    <div
      ref="kanbanContainerRef"
      class="nc-kanban-container flex p-3 overflow-y-hidden w-full nc-scrollbar-x-lg"
      :style="{
        minHeight: isMobileMode ? 'calc(100%  - 2rem)' : 'calc(100vh - var(--topbar-height) - var(--toolbar-height) - 0.4rem)',
        maxHeight: isMobileMode ? 'calc(100%  - 2rem)' : 'calc(100vh - var(--topbar-height) - var(--toolbar-height) - 0.4rem)',
      }"
    >
      <div v-if="isViewDataLoading" class="flex flex-row min-h-full gap-x-2">
        <a-skeleton-input v-for="index of Array(20)" :key="index" class="!min-w-80 !min-h-full !rounded-xl overflow-hidden" />
      </div>
      <NcDropdown
        v-else
        v-model:visible="contextMenu"
        :trigger="['contextmenu']"
        overlay-class-name="nc-dropdown-kanban-context-menu"
      >
        <div class="flex gap-3">
          <!-- Draggable Stack -->
          <Draggable
            v-model="groupingFieldColOptions"
            class="flex gap-3"
            item-key="id"
            group="kanban-stack"
            draggable=".nc-kanban-stack"
            handle=".nc-kanban-stack-drag-handler"
            :filter="draggableStackFilter"
            :move="onMoveCallback"
            @start="(e) => e.target.classList.add('grabbing')"
            @end="(e) => e.target.classList.remove('grabbing')"
            @change="onMoveStack($event)"
          >
            <template #item="{ element: stack, index: stackIdx }">
              <div
                class="nc-kanban-stack"
                :class="{
                  'w-[44px]': stack.collapsed,
                  'hidden':
                    (hideEmptyStack && !formattedData.get(stack.title)?.length) ||
                    (isRequiredGroupingFieldColumn && stack.id === uncategorizedStackId),
                }"
                :data-testid="`nc-kanban-stack-${stack.title}`"
              >
                <!-- Non Collapsed Stacks -->
                <a-card
                  v-if="!stack.collapsed"
                  :key="`${stack.id}-${stackIdx}`"
                  class="flex flex-col w-68.5 h-full !rounded-xl overflow-y-hidden !shadow-none !hover:shadow-none !border-gray-200"
                  :class="{
                    'not-draggable': stack.title === null || isLocked || isPublic || !hasEditPermission,
                    '!cursor-default': isLocked || !hasEditPermission,
                  }"
                  :head-style="{ paddingBottom: '0px' }"
                  :body-style="{
                    padding: '0px !important',
                    height: '100%',
                    borderRadius: '0.75rem !important',
                    paddingBottom: '0rem !important',
                  }"
                >
                  <!-- Skeleton -->
                  <div v-if="!formattedData.get(stack.title) || !countByStack" class="mt-2.5 px-3 !w-full">
                    <a-skeleton-input :active="true" class="!w-full !h-9.75 !rounded-lg overflow-hidden" />
                  </div>

                  <!-- Stack -->
                  <a-layout v-else>
                    <a-layout-header
                      class="border-b-1 border-gray-100 min-h-[49px]"
                      :class="`nc-kanban-stack-header-${stack.id}`"
                    >
                      <div
                        class="nc-kanban-stack-head w-full flex gap-1"
                        :class="{
                          'items-start': compareStack(stack, isRenameOrNewStack),
                          'items-center': !compareStack(stack, isRenameOrNewStack),
                        }"
                      >
                        <div
                          class="flex-1 flex gap-1 max-w-[calc(100%_-_32px)]"
                          :class="{
                            'items-start': compareStack(stack, isRenameOrNewStack),
                            'items-center': !compareStack(stack, isRenameOrNewStack),
                          }"
                        >
                          <NcButton
                            v-if="!(isLocked || isPublic || !hasEditPermission)"
                            :disabled="
                              !stack.title || compareStack(stack, isSavingStack) || compareStack(stack, isRenameOrNewStack)
                            "
                            type="text"
                            size="xs"
                            class="nc-kanban-stack-drag-handler !px-1.5 !cursor-move !:disabled:cursor-not-allowed mt-0.5"
                          >
                            <GeneralLoader v-if="compareStack(stack, isSavingStack)" size="regular" class="stack-rename-loader" />
                            <GeneralIcon v-else icon="ncDrag" class="!font-weight-800 flex-none" />
                          </NcButton>

                          <div
                            class="flex-1 flex max-w-[calc(100%_-_28px)]"
                            :class="{
                              '-ml-1': compareStack(stack, isRenameOrNewStack),
                            }"
                          >
                            <template
                              v-if="compareStack(stack, isRenameOrNewStack) && metaColumnById[isRenameOrNewStack?.fk_column_id]"
                            >
                              <SmartsheetKanbanEditOrAddStack
                                :column="metaColumnById[isRenameOrNewStack?.fk_column_id]"
                                :option-id="isRenameOrNewStack.id"
                                @submit="(loadMeta, payload) => handleSubmitRenameOrNewStack(loadMeta, payload, stackIdx)"
                              />
                            </template>
                            <a-tag
                              v-else
                              class="max-w-full !rounded-full !px-2 !py-1 h-7 !m-0 !border-none !mt-0.5"
                              :color="stack.color"
                              @dblclick="
                                () => {
                                  if (stack.title !== null && hasEditPermission && !isPublic && !isLocked) {
                                    isRenameOrNewStack = stack
                                  }
                                }
                              "
                            >
                              <span
                                :style="{
                                  color: tinycolor.isReadable(stack.color || '#ccc', '#fff', { level: 'AA', size: 'large' })
                                    ? '#fff'
                                    : tinycolor.mostReadable(stack.color || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
                                }"
                                class="text-sm font-semibold"
                              >
                                <NcTooltip class="truncate max-w-full" placement="bottom" show-on-truncate-only>
                                  <template #title>
                                    {{ stack.title ?? 'Uncategorized' }}
                                  </template>
                                  <span
                                    data-testid="nc-kanban-stack-title"
                                    class="text-ellipsis overflow-hidden"
                                    :style="{
                                      wordBreak: 'keep-all',
                                      whiteSpace: 'nowrap',
                                      display: 'inline',
                                    }"
                                  >
                                    {{ stack.title ?? 'Uncategorized' }}
                                  </span>
                                </NcTooltip>
                              </span>
                            </a-tag>
                          </div>
                        </div>
                        <NcDropdown
                          v-if="!isLocked"
                          placement="bottomRight"
                          overlay-class-name="nc-dropdown-kanban-stack-context-menu"
                          class="bg-white !rounded-lg"
                        >
                          <NcButton
                            :disabled="compareStack(stack, isSavingStack)"
                            type="text"
                            size="xs"
                            class="!px-1.5 mt-0.5"
                            data-testid="nc-kanban-stack-context-menu"
                          >
                            <GeneralIcon icon="threeDotVertical" />
                          </NcButton>

                          <template #overlay>
                            <NcMenu variant="small">
                              <NcMenuItem
                                v-if="hasEditPermission && !isPublic && !isLocked"
                                v-e="['c:kanban:add-new-record']"
                                data-testid="nc-kanban-context-menu-add-new-record"
                                @click="
                                  () => {
                                    selectedStackTitle = stack.title
                                    openNewRecordFormHook.trigger(stack.title)
                                  }
                                "
                              >
                                <div class="flex gap-2 items-center">
                                  <component :is="iconMap.plus" class="flex-none w-4 h-4" />
                                  {{ $t('activity.newRecord') }}
                                </div>
                              </NcMenuItem>
                              <NcMenuItem
                                v-if="stack.title !== null && hasEditPermission && !isPublic && !isLocked"
                                v-e="['c:kanban:rename-stack']"
                                data-testid="nc-kanban-context-menu-rename-stack"
                                @click="
                                  () => {
                                    isRenameOrNewStack = stack
                                  }
                                "
                              >
                                <div class="flex gap-2 items-center">
                                  <component :is="iconMap.ncEdit" class="flex-none w-4 h-4" />
                                  {{ $t('activity.kanban.renameStack') }}
                                </div>
                              </NcMenuItem>
                              <NcMenuItem
                                v-e="['c:kanban:collapse-stack']"
                                data-testid="nc-kanban-context-menu-collapse-stack"
                                @click="handleCollapseStack(stackIdx)"
                              >
                                <div class="flex gap-2 items-center">
                                  <component :is="iconMap.minimize" class="flex-none w-4 h-4" />
                                  {{ $t('activity.kanban.collapseStack') }}
                                </div>
                              </NcMenuItem>

                              <NcMenuItem
                                v-e="['c:kanban:collapse-all-stack']"
                                data-testid="nc-kanban-context-menu-collapse-all-stack"
                                @click="handleCollapseAllStack"
                              >
                                <div class="flex gap-2 items-center">
                                  <component :is="iconMap.minimizeAll" class="flex-none w-4 h-4" />
                                  {{ $t('activity.kanban.collapseAll') }}
                                </div>
                              </NcMenuItem>
                              <NcMenuItem
                                v-e="['c:kanban:expand-all-stack']"
                                data-testid="nc-kanban-context-menu-expand-all-stack"
                                @click="handleExpandAllStack"
                              >
                                <div class="flex gap-2 items-center">
                                  <component :is="iconMap.maximizeAll" class="flex-none w-4 h-4" />
                                  {{ $t('activity.kanban.expandAll') }}
                                </div>
                              </NcMenuItem>
                              <template v-if="stack.title !== null && !isPublic && hasEditPermission">
                                <NcDivider />
                                <NcMenuItem
                                  v-e="['c:kanban:delete-stack']"
                                  class="!text-red-600 !hover:bg-red-50"
                                  data-testid="nc-kanban-context-menu-delete-stack"
                                  @click="handleDeleteStackClick(stack.title, stackIdx)"
                                >
                                  <div class="flex gap-2 items-center">
                                    <component :is="iconMap.delete" class="flex-none w-4 h-4" />
                                    {{ $t('activity.kanban.deleteStack') }}
                                  </div>
                                </NcMenuItem>
                              </template>
                            </NcMenu>
                          </template>
                        </NcDropdown>
                      </div>
                    </a-layout-header>

                    <a-layout-content
                      class="overflow-y-hidden"
                      :style="{
                        backgroundColor: tinycolor
                          .mix(
                            stack.color || '#ccc',
                            '#ffffff',
                            tinycolor(stack.color || '#ccc').isLight()
                              ? 70
                              : tinycolor(stack.color || '#ccc').getBrightness() <= 100
                              ? 80
                              : 90,
                          )
                          .toString(),
                      }"
                    >
                      <div
                        :ref="kanbanListRef"
                        class="nc-kanban-list h-full px-2 nc-scrollbar-thin"
                        :data-stack-title="stack.title"
                      >
                        <!-- Draggable Record Card -->
                        <Draggable
                          :list="formattedData.get(stack.title)"
                          item-key="row.Id"
                          draggable=".nc-kanban-item"
                          group="kanban-card"
                          class="flex flex-col h-full"
                          :filter="draggableCardFilter"
                          @start="(e) => e.target.classList.add('grabbing')"
                          @end="(e) => e.target.classList.remove('grabbing')"
                          @change="onMove($event, stack.title)"
                        >
                          <template #item="{ element: record, index }">
                            <div class="nc-kanban-item py-1 first:pt-2 last:pb-2">
                              <LazySmartsheetRow :row="record">
                                <a-card
                                  :key="`${getRowId(record)}-${index}`"
                                  class="!rounded-lg h-full border-gray-200 border-1 group overflow-hidden break-all max-w-[450px] cursor-pointer"
                                  :body-style="{ padding: '16px !important' }"
                                  :data-stack="stack.title"
                                  :data-testid="`nc-gallery-card-${record.row.id}`"
                                  :class="{
                                    'not-draggable': !hasEditPermission || isPublic,
                                    '!cursor-default': !hasEditPermission || isPublic,
                                  }"
                                  @click="expandFormClick($event, record)"
                                  @contextmenu="showContextMenu($event, record)"
                                >
                                  <template v-if="kanbanMetaData?.fk_cover_image_col_id" #cover>
                                    <template v-if="!reloadAttachments && attachments(record).length">
                                      <a-carousel
                                        :key="attachments(record).reduce((acc, curr) => acc + curr?.path, '')"
                                        class="gallery-carousel !border-b-1 !border-gray-200"
                                        arrows
                                      >
                                        <template #customPaging>
                                          <a>
                                            <div>
                                              <div></div>
                                            </div>
                                          </a>
                                        </template>

                                        <template #prevArrow>
                                          <div class="z-10 arrow">
                                            <NcButton
                                              type="secondary"
                                              size="xsmall"
                                              class="!absolute !left-1.5 !bottom-[-90px] !opacity-0 !group-hover:opacity-100 !rounded-lg cursor-pointer"
                                            >
                                              <GeneralIcon icon="arrowLeft" class="text-gray-700 w-4 h-4" />
                                            </NcButton>
                                          </div>
                                        </template>

                                        <template #nextArrow>
                                          <div class="z-10 arrow">
                                            <NcButton
                                              type="secondary"
                                              size="xsmall"
                                              class="!absolute !right-1.5 !bottom-[-90px] !opacity-0 !group-hover:opacity-100 !rounded-lg cursor-pointer"
                                            >
                                              <GeneralIcon icon="arrowRight" class="text-gray-700 w-4 h-4" />
                                            </NcButton>
                                          </div>
                                        </template>

                                        <template v-for="attachment in attachments(record)">
                                          <LazyCellAttachmentPreviewImage
                                            v-if="isImage(attachment.title, attachment.mimetype ?? attachment.type)"
                                            :key="attachment.path"
                                            class="h-52"
                                            :class="[`${coverImageObjectFitClass}`]"
                                            :srcs="getPossibleAttachmentSrc(attachment, 'card_cover')"
                                          />
                                        </template>
                                      </a-carousel>
                                    </template>
                                    <div
                                      v-else
                                      class="h-52 w-full !flex flex-row !border-b-1 !border-gray-200 items-center justify-center"
                                    >
                                      <img class="object-contain w-[48px] h-[48px]" src="~assets/icons/FileIconImageBox.png" />
                                    </div>
                                  </template>
                                  <div class="flex flex-col gap-3 !children:pointer-events-none">
                                    <h2
                                      v-if="displayField"
                                      class="nc-card-display-value-wrapper"
                                      :class="{
                                        '!children:pointer-events-auto':
                                          isButton(displayField) ||
                                          (isRowEmpty(record, displayField) && isAllowToRenderRowEmptyField(displayField)),
                                      }"
                                    >
                                      <template
                                        v-if="!isRowEmpty(record, displayField) || isAllowToRenderRowEmptyField(displayField)"
                                      >
                                        <LazySmartsheetVirtualCell
                                          v-if="isVirtualCol(displayField)"
                                          v-model="record.row[displayField.title]"
                                          class="!text-brand-500"
                                          :column="displayField"
                                          :row="record"
                                        />

                                        <LazySmartsheetCell
                                          v-else
                                          v-model="record.row[displayField.title]"
                                          class="!text-brand-500"
                                          :column="displayField"
                                          :edit-enabled="false"
                                          :read-only="true"
                                        />
                                      </template>
                                      <template v-else> - </template>
                                    </h2>

                                    <div
                                      v-for="col in fieldsWithoutDisplay"
                                      :key="`record-${record.row.id}-${col.id}`"
                                      class="nc-card-col-wrapper"
                                      :class="{
                                        '!children:pointer-events-auto':
                                          isButton(col) || (isRowEmpty(record, col) && isAllowToRenderRowEmptyField(col)),
                                      }"
                                      @click="handleCellClick(col, $event)"
                                    >
                                      <div class="flex flex-col rounded-lg w-full">
                                        <div class="flex flex-row w-full justify-start">
                                          <div class="nc-card-col-header w-full !children:text-gray-500">
                                            <LazySmartsheetHeaderVirtualCell
                                              v-if="isVirtualCol(col)"
                                              :column="col"
                                              :hide-menu="true"
                                            />

                                            <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
                                          </div>
                                        </div>

                                        <div
                                          v-if="!isRowEmpty(record, col) || isAllowToRenderRowEmptyField(col)"
                                          class="flex flex-row w-full text-gray-800 items-center justify-start min-h-7 py-1"
                                        >
                                          <LazySmartsheetVirtualCell
                                            v-if="isVirtualCol(col)"
                                            v-model="record.row[col.title]"
                                            :column="col"
                                            :row="record"
                                            class="!text-gray-800"
                                          />

                                          <LazySmartsheetCell
                                            v-else
                                            v-model="record.row[col.title]"
                                            :column="col"
                                            :edit-enabled="false"
                                            :read-only="true"
                                            class="!text-gray-800"
                                          />
                                        </div>
                                        <div v-else class="flex flex-row w-full h-7 pl-1 items-center justify-start">-</div>
                                      </div>
                                    </div>
                                  </div>
                                </a-card>
                              </LazySmartsheetRow>
                            </div>
                          </template>
                          <template v-if="!formattedData.get(stack.title)?.length" #footer>
                            <div class="h-full w-full flex flex-col gap-4 items-center justify-center">
                              <div class="flex flex-col items-center gap-2 text-gray-600 text-center">
                                <span class="text-sm font-semibold">
                                  {{ $t('general.empty') }} {{ $t('general.stack').toLowerCase() }}
                                </span>
                                <span class="text-xs font-weight-500">
                                  {{ $t('title.looksLikeThisStackIsEmpty') }}
                                </span>
                              </div>
                              <NcButton
                                v-if="isUIAllowed('dataInsert')"
                                size="xs"
                                type="secondary"
                                @click="
                                  () => {
                                    selectedStackTitle = stack.title
                                    openNewRecordFormHook.trigger(stack.title)
                                  }
                                "
                              >
                                <div class="flex items-center gap-2">
                                  <component :is="iconMap.plus" v-if="!isPublic && !isLocked" />

                                  {{ $t('activity.newRecord') }}
                                </div>
                              </NcButton>
                            </div>
                          </template>
                        </Draggable>
                      </div>
                    </a-layout-content>
                    <a-layout-footer v-if="formattedData.get(stack.title)" class="border-t-1 border-gray-100">
                      <div class="flex items-center justify-between">
                        <NcButton
                          v-if="isUIAllowed('dataInsert')"
                          size="xs"
                          type="secondary"
                          @click="
                            () => {
                              selectedStackTitle = stack.title
                              openNewRecordFormHook.trigger(stack.title)
                            }
                          "
                        >
                          <div class="flex items-center gap-2">
                            <component :is="iconMap.plus" v-if="!isPublic && !isLocked" class="" />

                            {{ $t('activity.newRecord') }}
                          </div>
                        </NcButton>
                        <div v-else>&nbsp;</div>

                        <!-- Record Count -->
                        <div class="nc-kanban-data-count text-gray-500 font-weight-500 px-1">
                          {{ formattedData.get(stack.title)!.length }}/{{ countByStack.get(stack.title) ?? 0 }}
                          {{ countByStack.get(stack.title) !== 1 ? $t('objects.records') : $t('objects.record') }}
                        </div>
                      </div>
                    </a-layout-footer>
                  </a-layout>
                </a-card>

                <!-- Collapsed Stacks -->
                <a-card
                  v-else
                  :key="`${stack.id}-collapsed`"
                  class="nc-kanban-collapsed-stack flex items-center w-68.5 h-[44px] !rounded-xl cursor-pointer h-full !p-2 overflow-hidden !shadow-none !hover:shadow-none !border-gray-200"
                  :class="{
                    'not-draggable': stack.title === null || isLocked || isPublic || !hasEditPermission,
                  }"
                  :body-style="{
                    padding: '0px !important',
                    height: '100%',
                    width: '100%',
                    borderRadius: '0.75rem !important',
                    paddingBottom: '0rem !important',
                  }"
                >
                  <div class="h-full flex items-center justify-between" @click="handleCollapseStack(stackIdx)">
                    <div
                      v-if="!formattedData.get(stack.title) || !countByStack"
                      class="!w-full !h-full flex items-center justify-center"
                    >
                      <a-skeleton-input :active="true" class="!w-full !h-4 !rounded-lg overflow-hidden" />
                    </div>
                    <div v-else class="nc-kanban-stack-head w-full flex items-center justify-between gap-2">
                      <div class="flex items-center gap-1">
                        <NcButton
                          v-if="!(isLocked || isPublic || !hasEditPermission)"
                          :disabled="!stack.title"
                          type="text"
                          size="xs"
                          class="nc-kanban-stack-drag-handler !px-1.5 !cursor-move"
                          @click.stop
                        >
                          <GeneralIcon icon="ncDrag" class="font-weight-800 flex-none" />
                        </NcButton>

                        <div class="flex-1 flex max-w-[115px]">
                          <a-tag class="max-w-full !rounded-full !px-2 !py-1 h-7 !m-0 !border-none" :color="stack.color">
                            <span
                              :style="{
                                color: tinycolor.isReadable(stack.color || '#ccc', '#fff', { level: 'AA', size: 'large' })
                                  ? '#fff'
                                  : tinycolor.mostReadable(stack.color || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
                              }"
                              class="text-sm font-semibold"
                            >
                              <NcTooltip class="truncate max-w-full" placement="left" show-on-truncate-only>
                                <template #title>
                                  {{ stack.title ?? 'Uncategorized' }}
                                </template>
                                <span
                                  data-testid="nc-kanban-stack-title"
                                  class="text-ellipsis overflow-hidden"
                                  :style="{
                                    wordBreak: 'keep-all',
                                    whiteSpace: 'nowrap',
                                    display: 'inline',
                                  }"
                                >
                                  {{ stack.title ?? 'Uncategorized' }}
                                </span>
                              </NcTooltip>
                            </span>
                          </a-tag>
                        </div>
                      </div>

                      <div class="flex items-center gap-2 truncate">
                        <div
                          class="nc-kanban-data-count px-1 rounded bg-gray-200 text-gray-800 text-sm font-weight-500 truncate"
                          :style="{ 'word-break': 'keep-all', 'white-space': 'nowrap' }"
                        >
                          <!-- Record Count -->
                          {{ formattedData.get(stack.title)!.length }}
                          {{ countByStack.get(stack.title) !== 1 ? $t('objects.records') : $t('objects.record') }}
                        </div>

                        <NcButton type="text" size="xs" class="!px-1.5">
                          <component :is="iconMap.arrowDown" class="text-grey h-4 w-4 flex-none" />
                        </NcButton>
                      </div>
                    </div>
                  </div>
                </a-card>
              </div>
            </template>
          </Draggable>

          <div v-if="hasEditPermission && !isPublic && !isLocked && groupingFieldColumn?.id" class="nc-kanban-add-new-stack">
            <!-- Add New Stack -->
            <a-card
              class="flex flex-col w-68.5 !rounded-xl overflow-y-hidden !shadow-none !hover:shadow-none border-gray-200 nc-kanban-stack-header-new-stack"
              :class="[
                {
                  '!cursor-default': isLocked || !hasEditPermission,
                  '!border-none': !compareStack(addNewStackObj, isRenameOrNewStack),
                },
              ]"
              :head-style="{ paddingBottom: '0px' }"
              :body-style="{
                padding: '0px !important',
                height: '100%',
                borderRadius: '0.75rem !important',
                paddingBottom: '0rem !important',
              }"
            >
              <!-- Skeleton -->
              <div v-if="!formattedData.get(null) || !countByStack" class="mt-2.5 px-3 !w-full">
                <a-skeleton-input :active="true" class="!w-full !h-9.75 !rounded-lg overflow-hidden" />
              </div>

              <!-- Stack -->
              <a-layout v-else>
                <a-layout-header
                  :class="{
                    '!p-0 overflow-hidden': !compareStack(addNewStackObj, isRenameOrNewStack),
                  }"
                >
                  <div
                    class="w-full flex"
                    :class="{
                      'items-start': compareStack(addNewStackObj, isRenameOrNewStack),
                      'cursor-pointer': !compareStack(addNewStackObj, isRenameOrNewStack),
                    }"
                    @click="
                      () => {
                        if (!compareStack(addNewStackObj, isRenameOrNewStack)) {
                          isRenameOrNewStack = addNewStackObj
                        }
                      }
                    "
                  >
                    <NcButton
                      v-if="!compareStack(addNewStackObj, isRenameOrNewStack)"
                      type="secondary"
                      class="add-new-stack-btn w-full !rounded-xl min-h-11"
                    >
                      <div class="flex items-center gap-2">
                        <component :is="iconMap.plus" v-if="!isPublic && !isLocked" class="" />

                        {{ $t('general.new') }} {{ $t('general.stack').toLowerCase() }}
                      </div>
                    </NcButton>

                    <div
                      v-else
                      class="flex-1 flex"
                      :class="{
                        '-ml-1': compareStack(addNewStackObj, isRenameOrNewStack),
                      }"
                      @click.stop
                    >
                      <template
                        v-if="compareStack(addNewStackObj, isRenameOrNewStack) && metaColumnById[groupingFieldColumn?.id]"
                      >
                        <SmartsheetKanbanEditOrAddStack
                          :column="metaColumnById[groupingFieldColumn?.id]"
                          is-new-stack
                          @submit="(loadMeta) => handleSubmitRenameOrNewStack(loadMeta, undefined)"
                        />
                      </template>
                    </div>
                  </div>
                </a-layout-header>
              </a-layout>
            </a-card>
          </div>
        </div>
        <!-- Drop down Menu -->
        <template v-if="!isLocked && !isPublic && hasEditPermission" #overlay>
          <NcMenu variant="small" @click="contextMenu = false">
            <NcMenuItem v-if="contextMenuTarget" v-e="['a:kanban:expand-record']" @click="expandForm(contextMenuTarget)">
              <div class="flex items-center gap-2 nc-kanban-context-menu-item">
                <component :is="iconMap.maximize" class="flex" />
                <!-- Expand Record -->
                {{ $t('activity.expandRecord') }}
              </div>
            </NcMenuItem>
            <NcDivider />
            <NcMenuItem
              v-if="contextMenuTarget"
              v-e="['a:kanban:delete-record']"
              class="!text-red-600 !hover:bg-red-50"
              @click="deleteRow(contextMenuTarget)"
            >
              <div class="flex items-center gap-2 nc-kanban-context-menu-item">
                <component :is="iconMap.delete" class="flex" />
                <!-- Delete Record -->
                {{
                  $t('general.deleteEntity', {
                    entity: $t('objects.record').toLowerCase(),
                  })
                }}
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>
  </div>

  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :state="expandedFormRowState"
      :meta="meta"
      :load-row="!isPublic"
      :view="view"
      @cancel="removeRowFromUncategorizedStack"
    />
  </Suspense>

  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg && meta?.id"
      v-model="expandedFormOnRowIdDlg"
      :load-row="!isPublic"
      :row="expandedFormRow ?? { row: {}, oldRow: {}, rowMeta: {} }"
      :meta="meta"
      :expand-form="expandForm"
      :row-id="route.query.rowId"
      :view="view"
    />
  </Suspense>

  <GeneralDeleteModal v-model:visible="deleteStackVModel" entity-name="Stack" :on-delete="handleDeleteStackConfirmClick">
    <template #entity-preview>
      <div v-if="stackToBeDeleted" class="flex flex-row items-center py-2 px-2.25 bg-gray-100 rounded-lg text-gray-700 mb-4">
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ stackToBeDeleted }}
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>

<style lang="scss" scoped>
// override ant design style
.a-layout,
.ant-layout-header,
.ant-layout-footer {
  @apply !bg-white;
}
.ant-layout-content {
  background-color: unset;
}
.ant-layout-header,
.ant-layout-footer {
  @apply p-2 text-sm;
  height: unset !important;
}

.nc-kanban-collapsed-stack {
  transform: rotate(-90deg) translateX(-100%);
  transform-origin: left top 0px;
  transition: left 0.2s ease-in-out 0s;
}

:deep(.slick-dots li button) {
  @apply !bg-black;
}

.ant-carousel.gallery-carousel :deep(.slick-dots) {
  @apply !w-full max-w-[calc(100%_-_36%)] absolute left-0 right-0 bottom-[-18px] h-6 overflow-x-auto nc-scrollbar-thin !mx-auto;
}

.ant-carousel.gallery-carousel :deep(.slick-dots li div > div) {
  @apply rounded-full border-0 cursor-pointer block opacity-100 p-0 outline-none transition-all duration-500 text-transparent h-2 w-2 bg-[#d9d9d9];
  font-size: 0;
}

.ant-carousel.gallery-carousel :deep(.slick-dots li.slick-active div > div) {
  @apply bg-brand-500 opacity-100;
}

.ant-carousel.gallery-carousel :deep(.slick-dots li) {
  @apply !w-auto;
}
.ant-carousel.gallery-carousel :deep(.slick-prev) {
  @apply left-0;
}

.ant-carousel.gallery-carousel :deep(.slick-next) {
  @apply right-0;
}

:deep(.slick-slide) {
  @apply !pointer-events-none;
}

:deep(.ant-card) {
  @apply transition-shadow duration-0.3s;

  box-shadow: 0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02);

  &:hover {
    box-shadow: 0px 12px 16px -4px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.06);

    .nc-action-icon {
      @apply invisible;
    }
  }
}

.nc-card-display-value-wrapper {
  @apply my-0 text-xl leading-8 text-gray-600;

  .nc-cell,
  .nc-virtual-cell {
    @apply text-xl leading-8;

    :deep(.nc-cell-field),
    :deep(input),
    :deep(textarea),
    :deep(.nc-cell-field-link) {
      @apply !text-xl leading-8 text-gray-600;

      &:not(.ant-select-selection-search-input) {
        @apply !text-xl leading-8 text-gray-600;
      }
    }
  }
}

.nc-card-col-wrapper {
  @apply !text-small !leading-[18px];

  .nc-cell,
  .nc-virtual-cell {
    @apply !text-small !leading-[18px];

    :deep(.nc-cell-field),
    :deep(input),
    :deep(textarea),
    :deep(.nc-cell-field-link) {
      @apply !text-small leading-[18px];

      &:not(.ant-select-selection-search-input) {
        @apply !text-small leading-[18px];
      }
    }
  }
}

.nc-card-col-header {
  :deep(.nc-cell-icon),
  :deep(.nc-virtual-cell-icon) {
    @apply ml-0 !w-3.5 !h-3.5;
  }
}

:deep(.nc-cell) {
  &.nc-cell-longtext {
    .long-text-wrapper {
      @apply min-h-1;
      .nc-readonly-rich-text-wrapper {
        @apply !min-h-1;
      }
      .nc-rich-text {
        @apply pl-0;
        .tiptap.ProseMirror {
          @apply -ml-1 min-h-1;
        }
      }
    }
  }
  &.nc-cell-checkbox {
    @apply children:pl-0;
  }
  &.nc-cell-singleselect .nc-cell-field > div {
    @apply flex items-center;
  }
  &.nc-cell-multiselect .nc-cell-field > div {
    @apply h-5;
  }
  &.nc-cell-email,
  &.nc-cell-phonenumber {
    @apply flex items-center;
  }

  &.nc-cell-email,
  &.nc-cell-phonenumber,
  &.nc-cell-url {
    .nc-cell-field-link {
      @apply py-0;
    }
  }
}

:deep(.nc-virtual-cell) {
  .nc-links-wrapper {
    @apply py-0 children:min-h-4;
  }
  &.nc-virtual-cell-linktoanotherrecord {
    .chips-wrapper {
      @apply min-h-4 !children:min-h-4;
      .chip.group {
        @apply my-0;
      }
    }
  }
  &.nc-virtual-cell-lookup {
    .nc-lookup-cell {
      &:has(.nc-attachment-wrapper) {
        @apply !h-auto;

        .nc-attachment-cell {
          @apply !h-auto;

          .nc-attachment-wrapper {
            @apply py-0;
          }
        }
      }
      &:not(:has(.nc-attachment-wrapper)) {
        @apply !h-5.5;
      }
      .nc-cell-lookup-scroll {
        @apply py-0 h-auto;
      }
    }
  }
  &.nc-virtual-cell-formula {
    .nc-cell-field {
      @apply py-0;
    }
  }

  &.nc-virtual-cell-qrcode,
  &.nc-virtual-cell-barcode {
    @apply children:justify-start;
  }
}
</style>
