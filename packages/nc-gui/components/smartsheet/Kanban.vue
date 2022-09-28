<script lang="ts" setup>
import Draggable from 'vuedraggable'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
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
  ReadonlyInj,
  inject,
  onMounted,
  provide,
  useProvideKanbanViewStore,
} from '#imports'
import type { Row as RowType } from '~/composables'

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
  removeRowFromUncategorizedStack,
  shouldScrollToRight,
} = useProvideKanbanViewStore(meta, view)

const { isUIAllowed } = useUIPermission()

const { appInfo } = $(useGlobal())

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(true))

provide(ReadonlyInj, !isUIAllowed('xcDatatableEditable'))

const fields = inject(FieldsInj, ref([]))

const kanbanContainerRef = ref()

let isMounted = false

const isRowEmpty = (record: any, col: any) => {
  const val = record.row[col.title]
  if (!val) return true

  return Array.isArray(val) && val.length === 0
}

reloadViewDataHook?.on(async () => {
  await loadKanbanMeta()
  await loadKanbanData()
})

reloadViewMetaHook?.on(async () => {
  await loadKanbanMeta()
})

const expandForm = (row: RowType, state?: Record<string, any>) => {
  if (!isUIAllowed('xcDatatableEditable')) return

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
    const { grp_column_id, meta: stack_meta } = kanbanMetaData.value
    groupingFieldColOptions.value[oldIndex].order = newIndex
    groupingFieldColOptions.value[newIndex].order = oldIndex
    const stackMetaObj = JSON.parse(stack_meta as string) || {}
    stackMetaObj[grp_column_id as string] = groupingFieldColOptions.value
    await updateKanbanMeta({
      meta: stackMetaObj,
    })
  }
}

async function onMove(event: any, stackKey: string) {
  if (event.added) {
    const ele = event.added.element
    ele.row[groupingField.value] = stackKey === 'uncategorized' ? null : stackKey
    countByStack.value[stackKey] += 1
    await updateOrSaveRow(ele)
  } else if (event.removed) {
    countByStack.value[stackKey] -= 1
  }
}

const kanbanListScrollHandler = async (e: any) => {
  if (e.target.scrollTop + e.target.clientHeight >= e.target.scrollHeight) {
    const stackTitle = e.target.getAttribute('data-stack-title')
    const pageSize = appInfo.defaultLimit || 25
    const page = Math.ceil(formattedData.value[stackTitle].length / pageSize)
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

openNewRecordFormHook?.on(async (stackTitle) => {
  const newRow = await addEmptyRow()
  // preset the grouping field value
  newRow.row = {
    [groupingField.value]: stackTitle,
  }
  // increase total count by 1
  countByStack.value.uncategorized += 1
  // open the expanded form
  expandForm(newRow)
})

onMounted(async () => {
  // reset state to avoid from showing the previous stacks when switching kanban views
  groupingFieldColOptions.value = []
  formattedData.value = {}
  // load kanban meta
  await loadKanbanMeta()
  // load kanban data
  await loadKanbanData()
  // update isMounted for below watcher
  isMounted = true
})

watch(
  () => shouldScrollToRight.value,
  () => {
    // use `isMounted` to avoid scrolling from switching from other views
    // i.e. scroll only when a new option is added within kanban view
    if (isMounted && shouldScrollToRight.value) {
      // horizontally scroll to the end of the kanban container
      kanbanContainerRef.value.scrollTo({
        left: kanbanContainerRef.value.scrollWidth,
        behavior: 'smooth',
      })
      // reset shouldScrollToRight
      shouldScrollToRight.value = false
    }
  },
)
</script>

<template>
  <div class="flex h-full bg-white px-2">
    <div ref="kanbanContainerRef" class="nc-kanban-container flex my-4 px-3 overflow-x-scroll overflow-y-hidden">
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
                'not-draggable': stack.id === 'uncategorized' || isLocked || !isUIAllowed('xcDatatableEditable'),
                '!cursor-default': isLocked || !isUIAllowed('xcDatatableEditable'),
              }"
              :head-style="{ paddingBottom: '0px' }"
              :body-style="{ padding: '0px', height: '100%' }"
            >
              <!-- Header Color Bar -->
              <div :style="`background-color: ${stack.color}`" class="nc-kanban-stack-head-color h-[10px]"></div>

              <!-- Skeleton -->
              <a-skeleton v-if="!formattedData[stack.title] || !countByStack" class="p-4" />

              <!-- Stack -->
              <a-layout v-else class="!bg-[#f0f2f5]">
                <a-layout-header>
                  <div class="nc-kanban-stack-head font-bold flex items-center px-[15px]">
                    <a-dropdown :trigger="['click']" overlay-class-name="nc-dropdown-kanban-stack-context-menu">
                      <div
                        class="flex items-center cursor-pointer w-full"
                        :class="{ capitalize: stack.title === 'uncategorized' }"
                      >
                        <LazyGeneralTruncateText>{{ stack.title }}</LazyGeneralTruncateText>
                        <span class="w-full flex w-[15px]">
                          <mdi-menu-down class="text-grey text-lg ml-auto" />
                        </span>
                      </div>
                      <template #overlay>
                        <a-menu class="ml-6 !text-sm !px-0 !py-2 !rounded">
                          <a-menu-item
                            v-if="isUIAllowed('xcDatatableEditable')"
                            v-e="['c:kanban:add-new-record']"
                            @click="openNewRecordFormHook.trigger(stack.title === 'uncategorized' ? null : stack.title)"
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
                            v-if="stack.title !== 'uncategorized' && isUIAllowed('xcDatatableEditable')"
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
                      v-model="formattedData[stack.title]"
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
                                'not-draggable': isLocked || !isUIAllowed('xcDatatableEditable'),
                                '!cursor-default': isLocked || !isUIAllowed('xcDatatableEditable'),
                              }"
                              :body-style="{ padding: '10px' }"
                              @click="expandFormClick($event, record)"
                            >
                              <div
                                v-for="col in fields"
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
                                  class="flex flex-row w-full items-center justify-start"
                                  :class="{ 'pt- pl-2': col.uidt !== UITypes.SingleSelect }"
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
                  <div v-if="formattedData[stack.title] && countByStack[stack.title] >= 0" class="mt-5 text-center">
                    <!-- Stack Title -->
                    <mdi-plus
                      v-if="!isPublic"
                      class="text-pint-500 text-lg text-primary cursor-pointer"
                      @click="openNewRecordFormHook.trigger(stack.title === 'uncategorized' ? null : stack.title)"
                    />
                    <!-- Record Count -->
                    <div class="nc-kanban-data-count">
                      {{ formattedData[stack.title].length }} / {{ countByStack[stack.title] }}
                      {{ countByStack[stack.title] !== 1 ? $t('objects.records') : $t('objects.record') }}
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
              class="nc-kanban-stack nc-kanban-collapsed-stack mx-4 flex items-center w-[300px] h-[50px] rounded-[12px] cursor-pointer h-full !pr-[10px]"
              :class="{
                'not-draggable': stack.id === 'uncategorized' || isLocked || !isUIAllowed('xcDatatableEditable'),
              }"
              :body-style="{ padding: '0px', height: '100%', width: '100%', background: '#f0f2f5 !important' }"
            >
              <div class="items-center justify-between" @click="handleCollapseStack(stackIdx)">
                <!-- Skeleton -->
                <a-skeleton v-if="!formattedData[stack.title] || !countByStack" class="!w-[150px] pl-5" :paragraph="false" />

                <div v-else class="nc-kanban-data-count mt-[12px] mx-[10px]">
                  <!--  Stack title -->
                  <div class="float-right flex gap-2 items-center cursor-pointer font-bold">
                    <LazyGeneralTruncateText>{{ stack.title }}</LazyGeneralTruncateText>
                    <mdi-menu-down class="text-grey text-lg" />
                  </div>
                  <!-- Record Count -->
                  {{ formattedData[stack.title].length }} / {{ countByStack[stack.title] }}
                  {{ countByStack[stack.title] !== 1 ? $t('objects.records') : $t('objects.record') }}
                </div>
              </div>
            </a-card>
          </div>
        </template>
      </Draggable>
    </div>
  </div>

  <div class="flex-1" />

  <LazySmartsheetExpandedForm
    v-if="expandedFormRow && expandedFormDlg"
    v-model="expandedFormDlg"
    :row="expandedFormRow"
    :state="expandedFormRowState"
    :meta="meta"
    @cancel="removeRowFromUncategorizedStack"
  />

  <LazySmartsheetExpandedForm
    v-if="expandedFormOnRowIdDlg"
    :key="route.query.rowId"
    v-model="expandedFormOnRowIdDlg"
    :row="{ row: {}, oldRow: {}, rowMeta: {} }"
    :meta="meta"
    :row-id="route.query.rowId"
    :view="view"
  />

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
