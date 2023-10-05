<script lang="ts" setup>
import Draggable from 'vuedraggable'
import { UITypes, ViewTypes, isVirtualCol } from 'nocodb-sdk'
import {
  ActiveViewInj,
  FieldsInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
  IsKanbanInj,
  IsLockedInj,
  IsPublicInj,
  MetaInj,
  OpenNewRecordFormHookInj,
  extractPkFromRow,
  iconMap,
  inject,
  isImage,
  isLTAR,
  onBeforeUnmount,
  provide,
  useAttachment,
  useDebounceFn,
  useKanbanViewStoreOrThrow,
  useUndoRedo,
} from '#imports'
import type { Row as RowType } from '#imports'

interface Attachment {
  url: string
}

const INFINITY_SCROLL_THRESHOLD = 100

const emptyPagination = ref()

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

const deleteStackVModel = ref(false)

const stackToBeDeleted = ref('')

const stackIdxToBeDeleted = ref(0)

const router = useRouter()

const route = router.currentRoute

const { getPossibleAttachmentSrc } = useAttachment()

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
  countByStack,
  deleteStack,
  shouldScrollToRight,
  deleteRow,
  moveHistory,
} = useKanbanViewStoreOrThrow()

const { isViewDataLoading } = storeToRefs(useViewsStore())

const { isUIAllowed } = useRoles()

const { appInfo } = useGlobal()

const { addUndo, defineViewScope } = useUndoRedo()

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(true))

const hasEditPermission = computed(() => isUIAllowed('dataEdit'))

const fields = inject(FieldsInj, ref([]))

const fieldsWithoutCover = computed(() => fields.value.filter((f) => f.id !== kanbanMetaData.value?.fk_cover_image_col_id))

const coverImageColumn: any = computed(() =>
  meta.value?.columnsById
    ? meta.value.columnsById[kanbanMetaData.value?.fk_cover_image_col_id as keyof typeof meta.value.columnsById]
    : {},
)

const kanbanContainerRef = ref()

const selectedStackTitle = ref('')

const isRowEmpty = (record: any, col: any) => {
  const val = record.row[col.title]
  if (!val) return true

  return Array.isArray(val) && val.length === 0
}

reloadViewDataHook?.on(async () => {
  await loadKanbanMeta()
  await loadKanbanData()
})

const attachments = (record: any): Attachment[] => {
  try {
    if (coverImageColumn.value?.title && record.row[coverImageColumn.value.title]) {
      return typeof record.row[coverImageColumn.value.title] === 'string'
        ? JSON.parse(record.row[coverImageColumn.value.title])
        : record.row[coverImageColumn.value.title]
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

  if (rowId) {
    router.push({
      query: {
        ...route.value.query,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormRowState.value = state
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
    const stackMetaObj = JSON.parse(stack_meta as string) || {}
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
  if (e.target.scrollTop + e.target.clientHeight + INFINITY_SCROLL_THRESHOLD >= e.target.scrollHeight) {
    const stackTitle = e.target.getAttribute('data-stack-title')
    const pageSize = appInfo.value.defaultLimit || 25
    const stack = formattedData.value.get(stackTitle)
    if (stack) {
      const page = Math.ceil(stack.length / pageSize)
      await loadMoreKanbanData(stackTitle, { offset: page * pageSize })
    }
  }
})

const kanbanListRef = (kanbanListElement: HTMLElement) => {
  if (kanbanListElement) {
    kanbanListElement.removeEventListener('scroll', kanbanListScrollHandler)
    kanbanListElement.addEventListener('scroll', kanbanListScrollHandler)
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
          if (shouldScrollToRight.value) {
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
</script>

<template>
  <div
    class="flex flex-col w-full bg-white"
    data-testid="nc-kanban-wrapper"
    :style="{
      minHeight: 'calc(100vh - var(--topbar-height))',
    }"
  >
    <div
      ref="kanbanContainerRef"
      class="nc-kanban-container flex mt-4 pb-4 px-4 overflow-y-hidden w-full nc-scrollbar-x-md"
      :style="{
        minHeight: 'calc(100vh - var(--topbar-height) - 3.5rem)',
        maxHeight: 'calc(100vh - var(--topbar-height) - 3.5rem)',
      }"
    >
      <div v-if="isViewDataLoading" class="flex flex-row min-h-full gap-x-2">
        <a-skeleton-input v-for="index of Array(20)" :key="index" class="!min-w-80 !min-h-full !rounded-xl overflow-hidden" />
      </div>
      <a-dropdown
        v-else
        v-model:visible="contextMenu"
        :trigger="['contextmenu']"
        overlay-class-name="nc-dropdown-kanban-context-menu"
      >
        <!-- Draggable Stack -->
        <Draggable
          v-model="groupingFieldColOptions"
          class="flex gap-4"
          item-key="id"
          group="kanban-stack"
          draggable=".nc-kanban-stack"
          filter=".not-draggable"
          :move="onMoveCallback"
          @start="(e) => e.target.classList.add('grabbing')"
          @end="(e) => e.target.classList.remove('grabbing')"
          @change="onMoveStack($event)"
        >
          <template #item="{ element: stack, index: stackIdx }">
            <div class="nc-kanban-stack" :class="{ 'w-[50px]': stack.collapsed }">
              <!-- Non Collapsed Stacks -->
              <a-card
                v-if="!stack.collapsed"
                :key="stack.id"
                class="mx-4 !bg-gray-100 flex flex-col w-80 h-full !rounded-xl overflow-y-hidden"
                :class="{
                  'not-draggable': stack.title === null || isLocked || isPublic || !hasEditPermission,
                  '!cursor-default': isLocked || !hasEditPermission,
                }"
                :head-style="{ paddingBottom: '0px' }"
                :body-style="{ padding: '0px', height: '100%', borderRadius: '0.75rem !important', paddingBottom: '0rem' }"
              >
                <!-- Header Color Bar -->
                <div
                  :style="`background-color: ${stack.color}`"
                  class="nc-kanban-stack-head-color h-[10px] mt-3 mx-3 rounded-full"
                ></div>

                <!-- Skeleton -->
                <div v-if="!formattedData.get(stack.title) || !countByStack" class="mt-2.5 px-3 !w-full">
                  <a-skeleton-input :active="true" class="!w-full !h-9.75 !rounded-lg overflow-hidden" />
                </div>

                <!-- Stack -->
                <a-layout v-else class="!bg-gray-100">
                  <a-layout-header>
                    <div class="nc-kanban-stack-head font-medium flex items-center">
                      <a-dropdown
                        :trigger="['click']"
                        overlay-class-name="nc-dropdown-kanban-stack-context-menu"
                        class="bg-white !rounded-lg"
                      >
                        <div
                          class="flex items-center w-full mx-2 px-3 py-1"
                          :class="{ 'capitalize': stack.title === null, 'cursor-pointer': !isLocked }"
                        >
                          <LazyGeneralTruncateText>{{ stack.title ?? 'uncategorized' }}</LazyGeneralTruncateText>
                          <span v-if="!isLocked" class="w-full flex w-[15px]">
                            <component :is="iconMap.arrowDown" class="text-grey text-lg ml-auto" />
                          </span>
                        </div>
                        <template v-if="!isLocked" #overlay>
                          <a-menu class="ml-6 !text-sm !px-0 !py-2 !rounded">
                            <a-menu-item
                              v-if="hasEditPermission && !isPublic && !isLocked"
                              v-e="['c:kanban:add-new-record']"
                              @click="
                                () => {
                                  selectedStackTitle = stack.title
                                  openNewRecordFormHook.trigger(stack.title)
                                }
                              "
                            >
                              <div class="py-2 flex gap-2 items-center">
                                <component :is="iconMap.plus" class="text-gray-500" />
                                {{ $t('activity.addNewRecord') }}
                              </div>
                            </a-menu-item>
                            <a-menu-item v-e="['c:kanban:collapse-stack']" @click="handleCollapseStack(stackIdx)">
                              <div class="py-2 flex gap-1.8 items-center">
                                <component :is="iconMap.arrowCollapse" class="text-gray-500" />
                                {{ $t('activity.kanban.collapseStack') }}
                              </div>
                            </a-menu-item>
                            <a-menu-item
                              v-if="stack.title !== null && !isPublic && hasEditPermission"
                              v-e="['c:kanban:delete-stack']"
                              @click="handleDeleteStackClick(stack.title, stackIdx)"
                            >
                              <div class="py-2 flex gap-2 items-center">
                                <component :is="iconMap.delete" class="text-gray-500" />
                                {{ $t('activity.kanban.deleteStack') }}
                              </div>
                            </a-menu-item>
                          </a-menu>
                        </template>
                      </a-dropdown>
                    </div>
                  </a-layout-header>

                  <a-layout-content class="overflow-y-hidden mt-1" style="max-height: calc(100% - 11rem)">
                    <div :ref="kanbanListRef" class="nc-kanban-list h-full nc-scrollbar-dark-md" :data-stack-title="stack.title">
                      <!-- Draggable Record Card -->
                      <Draggable
                        :list="formattedData.get(stack.title)"
                        item-key="row.Id"
                        draggable=".nc-kanban-item"
                        group="kanban-card"
                        class="h-full"
                        filter=".not-draggable"
                        @start="(e) => e.target.classList.add('grabbing')"
                        @end="(e) => e.target.classList.remove('grabbing')"
                        @change="onMove($event, stack.title)"
                      >
                        <template #item="{ element: record }">
                          <div class="nc-kanban-item py-2 pl-3 pr-2">
                            <LazySmartsheetRow :row="record">
                              <a-card
                                hoverable
                                :data-stack="stack.title"
                                class="!rounded-xl h-full overflow-hidden break-all max-w-[450px]"
                                :class="{
                                  'not-draggable': isLocked || !hasEditPermission || isPublic,
                                  '!cursor-default': isLocked || !hasEditPermission || isPublic,
                                }"
                                :body-style="{ padding: '10px' }"
                                @click="expandFormClick($event, record)"
                                @contextmenu="showContextMenu($event, record)"
                              >
                                <template v-if="kanbanMetaData?.fk_cover_image_col_id" #cover>
                                  <a-carousel
                                    v-if="!reloadAttachments && attachments(record).length"
                                    autoplay
                                    class="gallery-carousel"
                                    arrows
                                  >
                                    <template #customPaging>
                                      <a>
                                        <div class="pt-[12px]">
                                          <div></div>
                                        </div>
                                      </a>
                                    </template>

                                    <template #prevArrow>
                                      <div style="z-index: 1"></div>
                                    </template>

                                    <template #nextArrow>
                                      <div style="z-index: 1"></div>
                                    </template>

                                    <template v-for="(attachment, index) in attachments(record)">
                                      <LazyCellAttachmentImage
                                        v-if="isImage(attachment.title, attachment.mimetype ?? attachment.type)"
                                        :key="`carousel-${record.row.id}-${index}`"
                                        class="h-52 object-cover"
                                        :srcs="getPossibleAttachmentSrc(attachment)"
                                      />
                                    </template>
                                  </a-carousel>

                                  <component :is="iconMap.imagePlaceholder" v-else class="w-full h-48 my-4 text-cool-gray-200" />
                                </template>
                                <div
                                  v-for="col in fieldsWithoutCover"
                                  :key="`record-${record.row.id}-${col.id}`"
                                  class="flex flex-col rounded-lg w-full"
                                >
                                  <div v-if="!isRowEmpty(record, col) || isLTAR(col.uidt, col.colOptions)">
                                    <!-- Smartsheet Header (Virtual) Cell -->
                                    <div class="flex flex-row w-full justify-start pt-2">
                                      <div class="w-full text-gray-400">
                                        <LazySmartsheetHeaderVirtualCell
                                          v-if="isVirtualCol(col)"
                                          :column="col"
                                          :hide-menu="true"
                                        />
                                        <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
                                      </div>
                                    </div>

                                    <!--  Smartsheet (Virtual) Cell -->
                                    <div
                                      class="flex flex-row w-full items-center justify-start"
                                      :class="{ '!ml-[-12px] pl-3': col.uidt === UITypes.SingleSelect }"
                                    >
                                      <LazySmartsheetVirtualCell
                                        v-if="col.title && isVirtualCol(col)"
                                        v-model="record.row[col.title]"
                                        class="text-sm pt-1 pl-5"
                                        :column="col"
                                        :row="record"
                                      />
                                      <LazySmartsheetCell
                                        v-else-if="col.title"
                                        v-model="record.row[col.title]"
                                        class="text-sm pt-1 pl-7.25"
                                        :column="col"
                                        :edit-enabled="false"
                                        :read-only="true"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </a-card>
                            </LazySmartsheetRow>
                          </div>
                        </template>
                      </Draggable>
                    </div>
                  </a-layout-content>

                  <div class="!rounded-lg !px-3 pt-3">
                    <div v-if="formattedData.get(stack.title)" class="text-center">
                      <!-- Stack Title -->

                      <!-- Record Count -->
                      <div class="nc-kanban-data-count text-gray-500">
                        {{ formattedData.get(stack.title)!.length }} / {{ countByStack.get(stack.title) ?? 0 }}
                        {{ countByStack.get(stack.title) !== 1 ? $t('objects.records') : $t('objects.record') }}
                      </div>

                      <div
                        class="flex flex-row w-full mt-3 justify-between items-center cursor-pointer bg-white px-4 py-2 rounded-lg border-gray-100 border-1 shadow-sm shadow-gray-100"
                        @click="
                          () => {
                            selectedStackTitle = stack.title
                            openNewRecordFormHook.trigger(stack.title)
                          }
                        "
                      >
                        Add Record
                        <component :is="iconMap.plus" v-if="!isPublic && !isLocked" class="" />
                      </div>
                    </div>
                  </div>
                </a-layout>
              </a-card>

              <!-- Collapsed Stacks -->
              <a-card
                v-else
                :key="`${stack.id}-collapsed`"
                :style="`background-color: ${stack.color} !important`"
                class="nc-kanban-collapsed-stack mx-4 flex items-center w-[300px] h-[50px] !rounded-xl cursor-pointer h-full !pr-[10px] overflow-hidden"
                :class="{
                  'not-draggable': stack.title === null || isLocked || isPublic || !hasEditPermission,
                }"
                :body-style="{ padding: '0px', height: '100%', width: '100%', background: '#f0f2f5 !important' }"
              >
                <div class="items-center justify-between" @click="handleCollapseStack(stackIdx)">
                  <div v-if="!formattedData.get(stack.title) || !countByStack" class="mt-4 px-3 !w-full">
                    <a-skeleton-input :active="true" class="!w-full !h-4 !rounded-lg overflow-hidden" />
                  </div>
                  <div v-else class="nc-kanban-data-count mt-[12px] mx-[10px]">
                    <!--  Stack title -->
                    <div
                      class="float-right flex gap-2 items-center cursor-pointer font-bold"
                      :class="{ capitalize: stack.title === null }"
                    >
                      <LazyGeneralTruncateText>{{ stack.title ?? 'uncategorized' }}</LazyGeneralTruncateText>
                      <component :is="iconMap.arrowDown" class="text-grey text-lg" />
                    </div>
                    <!-- Record Count -->
                    {{ formattedData.get(stack.title)!.length }} / {{ countByStack.get(stack.title) }}
                    {{ countByStack.get(stack.title) !== 1 ? $t('objects.records') : $t('objects.record') }}
                  </div>
                </div>
              </a-card>
            </div>
          </template>
        </Draggable>
        <!-- Drop down Menu -->
        <template v-if="!isLocked && !isPublic && hasEditPermission" #overlay>
          <a-menu class="shadow !rounded !py-0" @click="contextMenu = false">
            <a-menu-item v-if="contextMenuTarget" @click="expandForm(contextMenuTarget)">
              <div v-e="['a:kanban:expand-record']" class="nc-base-menu-item nc-kanban-context-menu-item">
                <component :is="iconMap.expand" class="flex" />
                <!-- Expand Record -->
                {{ $t('activity.expandRecord') }}
              </div>
            </a-menu-item>
            <a-divider class="!m-0 !p-0" />
            <a-menu-item v-if="contextMenuTarget" @click="deleteRow(contextMenuTarget)">
              <div v-e="['a:kanban:delete-record']" class="nc-base-menu-item nc-kanban-context-menu-item">
                <component :is="iconMap.delete" class="flex" />
                <!-- Delete Record -->
                {{ $t('activity.deleteRecord') }}
              </div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>
    <LazySmartsheetPagination v-model:pagination-data="emptyPagination" align-count-on-right hide-pagination class="!py-4">
    </LazySmartsheetPagination>
  </div>

  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :row="expandedFormRow"
      :state="expandedFormRowState"
      :meta="meta"
      :view="view"
    />
  </Suspense>

  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg"
      :key="route.query.rowId"
      v-model="expandedFormOnRowIdDlg"
      :row="{ row: {}, oldRow: {}, rowMeta: {} }"
      :meta="meta"
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
.ant-layout-content {
  @apply !bg-gray-100;
}

.ant-layout-header {
  @apply !h-[30px] !leading-[30px] !px-[5px] !my-[10px];
}

.nc-kanban-collapsed-stack {
  transform: rotate(-90deg) translateX(-100%);
  transform-origin: left top 0px;
  transition: left 0.2s ease-in-out 0s;
}
</style>
