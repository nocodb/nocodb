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
  inject,
  onBeforeMount,
  onBeforeUnmount,
  provide,
  useKanbanViewStoreOrThrow,
} from '#imports'
import type { Row as RowType } from '~/lib'

interface Attachment {
  url: string
}

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

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

const route = useRoute()

const router = useRouter()

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
} = useKanbanViewStoreOrThrow()

const { isUIAllowed } = useUIPermission()

const { appInfo } = $(useGlobal())

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(true))

const hasEditPermission = $computed(() => isUIAllowed('xcDatatableEditable'))

const fields = inject(FieldsInj, ref([]))

const fieldsWithoutCover = computed(() => fields.value.filter((f) => f.id !== kanbanMetaData.value?.fk_cover_image_col_id))

const coverImageColumn: any = $(
  computed(() =>
    meta.value?.columnsById
      ? meta.value.columnsById[kanbanMetaData.value?.fk_cover_image_col_id as keyof typeof meta.value.columnsById]
      : {},
  ),
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
    return coverImageColumn?.title && record.row[coverImageColumn.title] ? JSON.parse(record.row[coverImageColumn.title]) : []
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
        ...route.query,
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
    if (hasEditPermission) {
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
    return !!route.query.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...route.query,
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

async function onMoveStack(event: any) {
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
  }
}

async function onMove(event: any, stackKey: string) {
  if (event.added) {
    const ele = event.added.element
    ele.row[groupingField.value] = stackKey
    countByStack.value.set(stackKey, countByStack.value.get(stackKey)! + 1)
    await updateOrSaveRow(ele)
  } else if (event.removed) {
    countByStack.value.set(stackKey, countByStack.value.get(stackKey)! - 1)
  }
}

const kanbanListScrollHandler = async (e: any) => {
  if (e.target.scrollTop + e.target.clientHeight >= e.target.scrollHeight) {
    const stackTitle = e.target.getAttribute('data-stack-title')
    const pageSize = appInfo.defaultLimit || 25
    const page = Math.ceil(formattedData.value.get(stackTitle)!.length / pageSize)
    await loadMoreKanbanData(stackTitle, { offset: page * pageSize })
  }
}

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
    [groupingField.value]: selectedStackTitle.value,
  }
  // increase total count by 1
  countByStack.value.set(null, countByStack.value.get(null)! + 1)
  // open the expanded form
  expandForm(newRow)
}

openNewRecordFormHook?.on(openNewRecordFormHookHandler)

onBeforeMount(async () => {
  await loadKanbanMeta()
  await loadKanbanData()
})

// remove openNewRecordFormHookHandler before unmounting
// so that it won't be triggered multiple times
onBeforeUnmount(() => openNewRecordFormHook.off(openNewRecordFormHookHandler))

// reset context menu target on hide
watch(contextMenu, () => {
  if (!contextMenu.value) {
    contextMenuTarget.value = null
  }
})

watch(view, async (nextView) => {
  if (nextView?.type === ViewTypes.KANBAN) {
    // load kanban meta
    await loadKanbanMeta()
    // load kanban data
    await loadKanbanData()
    // horizontally scroll to the end of the kanban container
    // when a new option is added within kanban view
    if (shouldScrollToRight.value) {
      kanbanContainerRef.value.scrollTo({
        left: kanbanContainerRef.value.scrollWidth,
        behavior: 'smooth',
      })
      // reset shouldScrollToRight
      shouldScrollToRight.value = false
    }
  }
})
</script>

<template>
  <div class="flex h-full bg-white px-2" data-testid="nc-kanban-wrapper">
    <div ref="kanbanContainerRef" class="nc-kanban-container flex my-4 px-3 overflow-x-scroll overflow-y-hidden">
      <a-dropdown v-model:visible="contextMenu" :trigger="['contextmenu']" overlay-class-name="nc-dropdown-kanban-context-menu">
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
                class="mx-4 !bg-[#f0f2f5] flex flex-col w-[280px] h-full rounded-[12px]"
                :class="{
                  'not-draggable': stack.title === null || isLocked || isPublic || !hasEditPermission,
                  '!cursor-default': isLocked || !hasEditPermission,
                }"
                :head-style="{ paddingBottom: '0px' }"
                :body-style="{ padding: '0px', height: '100%' }"
              >
                <!-- Header Color Bar -->
                <div :style="`background-color: ${stack.color}`" class="nc-kanban-stack-head-color h-[10px]"></div>

                <!-- Skeleton -->
                <a-skeleton v-if="!formattedData.get(stack.title) || !countByStack" class="p-4" />

                <!-- Stack -->
                <a-layout v-else class="!bg-[#f0f2f5]">
                  <a-layout-header>
                    <div class="nc-kanban-stack-head font-bold flex items-center px-[15px]">
                      <a-dropdown :trigger="['click']" overlay-class-name="nc-dropdown-kanban-stack-context-menu">
                        <div
                          class="flex items-center w-full"
                          :class="{ 'capitalize': stack.title === null, 'cursor-pointer': !isLocked }"
                        >
                          <LazyGeneralTruncateText>{{ stack.title ?? 'uncategorized' }}</LazyGeneralTruncateText>
                          <span v-if="!isLocked" class="w-full flex w-[15px]">
                            <mdi-menu-down class="text-grey text-lg ml-auto" />
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
                                <mdi-plus class="text-gray-500" />
                                {{ $t('activity.addNewRecord') }}
                              </div>
                            </a-menu-item>
                            <a-menu-item v-e="['c:kanban:collapse-stack']" @click="handleCollapseStack(stackIdx)">
                              <div class="py-2 flex gap-2 items-center">
                                <mdi-arrow-collapse class="text-gray-500" />
                                {{ $t('activity.kanban.collapseStack') }}
                              </div>
                            </a-menu-item>
                            <a-menu-item
                              v-if="stack.title !== null && !isPublic && hasEditPermission"
                              v-e="['c:kanban:delete-stack']"
                              @click="handleDeleteStackClick(stack.title, stackIdx)"
                            >
                              <div class="py-2 flex gap-2 items-center">
                                <mdi-delete class="text-gray-500" />
                                {{ $t('activity.kanban.deleteStack') }}
                              </div>
                            </a-menu-item>
                          </a-menu>
                        </template>
                      </a-dropdown>
                    </div>
                  </a-layout-header>

                  <a-layout-content class="overflow-y-hidden">
                    <div :ref="kanbanListRef" class="nc-kanban-list h-full overflow-y-auto" :data-stack-title="stack.title">
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
                          <div class="nc-kanban-item py-2 px-[15px]">
                            <LazySmartsheetRow :row="record">
                              <a-card
                                hoverable
                                :data-stack="stack.title"
                                class="!rounded-lg h-full overflow-hidden break-all max-w-[450px] shadow-lg"
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

                                    <LazyNuxtImg
                                      v-for="(attachment, index) in attachments(record)"
                                      :key="`carousel-${record.row.id}-${index}`"
                                      quality="90"
                                      placeholder
                                      class="h-52 object-cover"
                                      :src="attachment.url"
                                    />
                                  </a-carousel>

                                  <MdiFileImageBox v-else class="w-full h-48 my-4 text-cool-gray-200" />
                                </template>
                                <div
                                  v-for="col in fieldsWithoutCover"
                                  :key="`record-${record.row.id}-${col.id}`"
                                  class="flex flex-col rounded-lg w-full"
                                >
                                  <!-- Smartsheet Header (Virtual) Cell -->
                                  <div v-if="!isRowEmpty(record, col)" class="flex flex-row w-full justify-start pt-2">
                                    <div class="w-full text-gray-400">
                                      <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="true" />
                                      <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
                                    </div>
                                  </div>

                                  <!--  Smartsheet (Virtual) Cell -->
                                  <div
                                    v-if="!isRowEmpty(record, col)"
                                    class="flex flex-row w-full items-center justify-start pl-[6px]"
                                    :class="{ '!ml-[-12px]': col.uidt === UITypes.SingleSelect }"
                                  >
                                    <LazySmartsheetVirtualCell
                                      v-if="isVirtualCol(col)"
                                      v-model="record.row[col.title]"
                                      class="text-sm pt-1"
                                      :column="col"
                                      :row="record"
                                    />
                                    <LazySmartsheetCell
                                      v-else
                                      v-model="record.row[col.title]"
                                      class="text-sm pt-1"
                                      :column="col"
                                      :edit-enabled="false"
                                      :read-only="true"
                                    />
                                  </div>
                                </div>
                              </a-card>
                            </LazySmartsheetRow>
                          </div>
                        </template>
                      </Draggable>
                    </div>
                  </a-layout-content>

                  <a-layout-footer>
                    <div v-if="formattedData.get(stack.title) && countByStack.get(stack.title) >= 0" class="mt-5 text-center">
                      <!-- Stack Title -->
                      <mdi-plus
                        v-if="!isPublic && !isLocked"
                        class="text-pint-500 text-lg text-primary cursor-pointer"
                        @click="
                          () => {
                            selectedStackTitle = stack.title
                            openNewRecordFormHook.trigger(stack.title)
                          }
                        "
                      />
                      <!-- Record Count -->
                      <div class="nc-kanban-data-count">
                        {{ formattedData.get(stack.title).length }} / {{ countByStack.get(stack.title) }}
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
                :style="`background-color: ${stack.color} !important`"
                class="nc-kanban-collapsed-stack mx-4 flex items-center w-[300px] h-[50px] rounded-[12px] cursor-pointer h-full !pr-[10px]"
                :class="{
                  'not-draggable': stack.title === null || isLocked || isPublic || !hasEditPermission,
                }"
                :body-style="{ padding: '0px', height: '100%', width: '100%', background: '#f0f2f5 !important' }"
              >
                <div class="items-center justify-between" @click="handleCollapseStack(stackIdx)">
                  <!-- Skeleton -->
                  <a-skeleton
                    v-if="!formattedData.get(stack.title) || !countByStack"
                    class="!w-[150px] pl-5"
                    :paragraph="false"
                  />

                  <div v-else class="nc-kanban-data-count mt-[12px] mx-[10px]">
                    <!--  Stack title -->
                    <div
                      class="float-right flex gap-2 items-center cursor-pointer font-bold"
                      :class="{ capitalize: stack.title === null }"
                    >
                      <LazyGeneralTruncateText>{{ stack.title ?? 'uncategorized' }}</LazyGeneralTruncateText>
                      <mdi-menu-down class="text-grey text-lg" />
                    </div>
                    <!-- Record Count -->
                    {{ formattedData.get(stack.title).length }} / {{ countByStack.get(stack.title) }}
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
              <div v-e="['a:kanban:expand-record']" class="nc-project-menu-item nc-kanban-context-menu-item">
                <MdiArrowExpand class="flex" />
                <!-- Expand Record -->
                {{ $t('activity.expandRecord') }}
              </div>
            </a-menu-item>
            <a-divider class="!m-0 !p-0" />
            <a-menu-item v-if="contextMenuTarget" @click="deleteRow(contextMenuTarget)">
              <div v-e="['a:kanban:delete-record']" class="nc-project-menu-item nc-kanban-context-menu-item">
                <MdiDeleteOutline class="flex" />
                <!-- Delete Record -->
                {{ $t('activity.deleteRecord') }}
              </div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>
  </div>

  <div class="flex-1" />

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

  <a-modal v-model:visible="deleteStackVModel" class="!top-[35%]" wrap-class-name="nc-modal-kanban-delete-stack">
    <template #title>
      {{ $t('activity.deleteKanbanStack') }}
    </template>
    <div>
      {{ $t('msg.info.deleteKanbanStackConfirmation', { stackToBeDeleted, groupingField }) }}
    </div>
    <template #footer>
      <a-button key="back" v-e="['c:kanban:cancel-delete-stack']" @click="deleteStackVModel = false">
        {{ $t('general.cancel') }}
      </a-button>
      <a-button key="submit" v-e="['c:kanban:confirm-delete-stack']" type="primary" @click="handleDeleteStackConfirmClick">
        {{ $t('general.delete') }}
      </a-button>
    </template>
  </a-modal>
</template>

<style lang="scss" scoped>
// override ant design style
.a-layout,
.ant-layout-header,
.ant-layout-content {
  @apply !bg-[#f0f2f5];
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
