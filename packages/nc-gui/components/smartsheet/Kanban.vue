<script lang="ts" setup>
import Draggable from 'vuedraggable'
import { isVirtualCol } from 'nocodb-sdk'
import {
  ActiveViewInj,
  FieldsInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
  IsKanbanInj,
  MetaInj,
  OpenNewRecordFormHookInj,
  ReadonlyInj,
  inject,
  provide,
  useKanbanViewData,
} from '#imports'
import Row from '~/components/smartsheet/Row.vue'
import type { Row as RowType } from '~/composables'

interface Attachment {
  url: string
}

const meta = inject(MetaInj)
const view = inject(ActiveViewInj)
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const expandedFormDlg = ref(false)
const expandedFormRow = ref<RowType>()
const expandedFormRowState = ref<Record<string, any>>()

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
  groupingField,
  groupingFieldColumn,
  countByStack,
} = useKanbanViewData(meta, view as any)

const { isUIAllowed } = useUIPermission()

const { appInfo } = $(useGlobal())

const { isLoading: loading, api } = useApi()

provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(false))
provide(IsGridInj, ref(false))
provide(IsKanbanInj, ref(true))
provide(ReadonlyInj, !isUIAllowed('xcDatatableEditable'))

const fields = inject(FieldsInj, ref([]))

const fieldsWithoutCover = computed(() => fields.value.filter((f) => f.id !== kanbanMetaData.value?.fk_cover_image_col_id))

// const coverImageColumn: any = $(
//   computed(() =>
//     meta?.value.columnsById
//       ? meta.value.columnsById[kanbanData.value?.fk_cover_image_col_id as keyof typeof meta.value.columnsById]
//       : {},
//   ),
// )

watch(
  [meta, view],
  async () => {
    if (meta?.value && view?.value) {
      await loadKanbanMeta()
      await loadKanbanData()
    }
  },
  { immediate: true },
)

const isRowEmpty = (record: any, col: any) => {
  const val = record.row[col.title]
  if (!val) return true

  return Array.isArray(val) && val.length === 0
}

// const attachments = (record: any): Array<Attachment> => {
//   try {
//     return coverImageColumn?.title && record.row[coverImageColumn.title] ? JSON.parse(record.row[coverImageColumn.title]) : []
//   } catch (e) {
//     return []
//   }
// }

const reloadAttachments = ref(false)

reloadViewDataHook?.on(async () => {
  await loadKanbanMeta()
  await loadKanbanData()
  reloadAttachments.value = true
  nextTick(() => {
    reloadAttachments.value = false
  })
})

const expandForm = (row: RowType, state?: Record<string, any>) => {
  if (!isUIAllowed('xcDatatableEditable')) return
  expandedFormRow.value = row
  expandedFormRowState.value = state
  expandedFormDlg.value = true
}

const expandFormClick = async (e: MouseEvent, row: RowType) => {
  const target = e.target as HTMLElement
  if (target && !target.closest('.gallery-carousel')) {
    expandForm(row)
  }
}

/** Block dragging the stack to first index (reserved for Uncategorized) **/
function onMoveCallback(event: any) {
  if (event.draggedContext.futureIndex === 0) {
    return false
  }
}

async function onMoveStack(event: any) {
  if (event.moved) {
    const { oldIndex, newIndex } = event.moved
    const { grp_column_id, stack_meta } = kanbanMetaData.value
    groupingFieldColOptions.value[oldIndex].order = newIndex
    groupingFieldColOptions.value[newIndex].order = oldIndex
    const stackMetaObj = JSON.parse(stack_meta as string) || {}
    stackMetaObj[grp_column_id as string] = groupingFieldColOptions.value
    await updateKanbanMeta({
      stack_meta: stackMetaObj,
    })
  }
}

async function onMove(event: any, stackKey: string) {
  if (event.added) {
    const ele = event.added.element
    ele.row[groupingField.value] = stackKey === 'Uncategorized' ? null : stackKey
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

const collapseStack = () => {
  // TODO:
}

const renameStack = () => {
  // TODO:
}

const deleteStack = () => {
  // TODO:
}

const deleteStackVModel = ref(false)

openNewRecordFormHook?.on(async () => {
  const newRow = await addEmptyRow()
  expandForm(newRow)
})
</script>

<template>
  <div class="flex h-full bg-white px-2">
    <div class="nc-kanban-container flex my-4 px-3 overflow-x-scroll overflow-y-hidden">
      <Draggable
        v-model="groupingFieldColOptions"
        class="flex gap-4"
        item-key="id"
        group="kanban-stack"
        draggable=".nc-kanban-stack"
        filter=".not-draggable"
        :move="onMoveCallback"
        @change="onMoveStack($event)"
      >
        <template #item="{ element: stack, index }">
          <a-card
            :key="stack.id"
            class="nc-kanban-stack mx-4 !bg-[#f0f2f5] flex flex-col w-[280px] h-full rounded-[12px]"
            :class="{ 'not-draggable': stack.id === 'uncategorized' }"
            head-style="padding-bottom: 0px;"
            body-style="padding: 0px; height: 100%;"
          >
            <div :style="`background-color: ${stack.color}`" class="nc-kanban-stack-head-color h-[10px]"></div>
            <a-skeleton v-if="!formattedData[stack.title]" class="p-4" />
            <a-layout v-else class="px-[15px] !bg-[#f0f2f5]">
              <a-layout-header>
                <div class="nc-kanban-stack-head text-slate-500 font-bold flex items-center">
                  <a-dropdown :trigger="['click']" overlay-class-name="nc-dropdown-actions-menu">
                    <div class="flex gap-2 items-center cursor-pointer">
                      <GeneralTruncateText>{{ stack.title }}</GeneralTruncateText>
                      <mdi-menu-down class="text-grey text-lg" />
                    </div>
                    <template #overlay>
                      <a-menu class="ml-6 !text-sm !px-0 !py-2 !rounded">
                        <a-menu-item @click="openNewRecordFormHook.trigger()">
                          <div class="py-2 flex gap-2 items-center">
                            <mdi-plus class="text-gray-500" />
                            <!-- TODO: i18n -->
                            Add new record
                          </div>
                        </a-menu-item>
                        <a-menu-item @click="collapseStack">
                          <div class="py-2 flex gap-2 items-center">
                            <mdi-arrow-collapse class="text-gray-500" />
                            <!-- TODO: i18n -->
                            Collapse Stack
                          </div>
                        </a-menu-item>
                        <a-menu-item @click="renameStack">
                          <div class="py-2 flex gap-2 items-center">
                            <mdi-pencil class="text-gray-500" />
                            <!-- TODO: i18n -->
                            Rename Stack
                          </div>
                        </a-menu-item>
                        <a-menu-item @click="deleteStackVModel = true">
                          <div class="py-2 flex gap-2 items-center">
                            <mdi-delete class="text-gray-500" />
                            <!-- TODO: i18n -->
                            Delete Stack
                          </div>
                        </a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </div>
              </a-layout-header>
              <a-layout-content class="overflow-y-hidden">
                <div :ref="kanbanListRef" class="nc-kanban-list h-full overflow-y-auto" :data-stack-title="stack.title">
                  <Draggable
                    v-model="formattedData[stack.title]"
                    item-key="row.Id"
                    draggable=".nc-kanban-item"
                    group="kanban-card"
                    class="h-full"
                    @change="onMove($event, stack.title)"
                  >
                    <template #item="{ element: record }">
                      <div class="nc-kanban-item py-2">
                        <Row :row="record">
                          <a-card
                            hoverable
                            :data-stack="stack.title"
                            class="!rounded-lg h-full overflow-hidden break-all max-w-[450px]"
                            body-style="padding: 10px;"
                            @click="expandFormClick($event, record)"
                          >
                            <!--                            <template #cover> -->
                            <!--                              <a-carousel -->
                            <!--                                v-if="!reloadAttachments && attachments(record).length" -->
                            <!--                                autoplay -->
                            <!--                                class="gallery-carousel" -->
                            <!--                                arrows -->
                            <!--                              > -->
                            <!--                                <template #customPaging> -->
                            <!--                                  <a> -->
                            <!--                                    <div class="pt-[12px]"><div></div></div> -->
                            <!--                                  </a> -->
                            <!--                                </template> -->
                            <!--                                <template #prevArrow> -->
                            <!--                                  <div style="z-index: 1"></div> -->
                            <!--                                </template> -->
                            <!--                                <template #nextArrow> -->
                            <!--                                  <div style="z-index: 1"></div> -->
                            <!--                                </template> -->
                            <!--                                <img -->
                            <!--                                  v-for="(attachment, index) in attachments(record)" -->
                            <!--                                  :key="`carousel-${record.row.id}-${index}`" -->
                            <!--                                  class="h-52" -->
                            <!--                                  :src="attachment.url" -->
                            <!--                                /> -->
                            <!--                              </a-carousel> -->
                            <!--                            </template> -->

                            <div
                              v-for="col in fieldsWithoutCover"
                              :key="`record-${record.row.id}-${col.id}`"
                              class="flex flex-col space-y-1 px-1 mb-3 bg-gray-50 rounded-lg w-full"
                            >
                              <div class="flex flex-row w-full justify-start border-b-1 border-gray-100 py-2.5">
                                <div class="w-full text-gray-600">
                                  <SmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="true" />
                                  <SmartsheetHeaderCell v-else :column="col" :hide-menu="true" />
                                </div>
                              </div>

                              <div class="flex flex-row w-full pb-3 pt-2 pl-2 items-center justify-start">
                                <div v-if="isRowEmpty(record, col)" class="h-3 bg-gray-200 px-5 rounded-lg"></div>
                                <template v-else>
                                  <SmartsheetVirtualCell
                                    v-if="isVirtualCol(col)"
                                    v-model="record.row[col.title]"
                                    :column="col"
                                    :row="record"
                                  />
                                  <SmartsheetCell
                                    v-else
                                    v-model="record.row[col.title]"
                                    :column="col"
                                    :edit-enabled="false"
                                    :read-only="true"
                                  />
                                </template>
                              </div>
                            </div>
                          </a-card>
                        </Row>
                      </div>
                    </template>
                  </Draggable>
                </div>
              </a-layout-content>
              <a-layout-footer>
                <div v-if="formattedData[stack.title] && countByStack[stack.title] >= 0" class="mt-5 text-center">
                  <mdi-plus class="text-pint-500 text-lg text-primary cursor-pointer" @click="openNewRecordFormHook.trigger()" />
                  <div class="nc-kanban-data-count">
                    <!-- TODO: fix current count for Uncategorized-->
                    {{ formattedData[stack.title].length }} / {{ countByStack[stack.title] }}
                    {{ countByStack[stack.title] !== 1 ? $t('objects.records') : $t('objects.record') }}
                  </div>
                </div>
              </a-layout-footer>
            </a-layout>
          </a-card>
        </template>
      </Draggable>
    </div>
  </div>
  <div class="flex-1" />
  <SmartsheetExpandedForm
    v-if="expandedFormRow && expandedFormDlg"
    v-model="expandedFormDlg"
    :row="expandedFormRow"
    :state="expandedFormRowState"
    :meta="meta"
  />
  <a-modal
    v-model:visible="deleteStackVModel"
    class="!top-[35%]"
    :confirm-loading="loading"
    wrap-class-name="nc-modal-view-create"
  >
    <template #title>
      <!-- TODO: i18n -->
      Delete stack?
    </template>
    <div>
      <!-- TODO: i18n -->
      Deleting this stack will also remove the select option from the `{{ groupingField }}`. The records will move to the
      uncategorized stack.
    </div>
    <template #footer>
      <a-button key="back" @click="deleteStackVModel = false">{{ $t('general.cancel') }}</a-button>
      <a-button key="submit" type="primary" :loading="loading" @click="deleteStack">{{ $t('general.delete') }}</a-button>
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
</style>
