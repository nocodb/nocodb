<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'
import { UITypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import type { Ref } from 'vue'
import {
  CellClickHookInj,
  FieldsInj,
  IsFormInj,
  IsKanbanInj,
  MetaInj,
  ReloadRowDataHookInj,
  computedInject,
  createEventHook,
  inject,
  message,
  provide,
  ref,
  toRef,
  useProvideExpandedFormStore,
  useProvideSmartsheetStore,
  useRouter,
  useVModel,
  watch,
} from '#imports'
import { useActiveKeyupListener } from '~/composables/useSelectedCellKeyupListener'
import type { Row } from '~/lib'

interface Props {
  modelValue?: boolean
  row: Row
  state?: Record<string, any> | null
  meta: TableType
  loadRow?: boolean
  useMetaFields?: boolean
  rowId?: string
  view?: ViewType
  showNextPrevIcons?: boolean
  firstRow?: boolean
  lastRow?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'cancel', 'next', 'prev'])

const key = ref(0)

const { t } = useI18n()

const row = ref(props.row)

const state = toRef(props, 'state')

const meta = toRef(props, 'meta')

const router = useRouter()

// override cell click hook to avoid unexpected behavior at form fields
provide(CellClickHookInj, null)

const fields = computedInject(FieldsInj, (_fields) => {
  if (props.useMetaFields) {
    return (meta.value.columns ?? []).filter((col) => !isSystemColumn(col))
  }
  return _fields?.value ?? []
})

const isKanban = inject(IsKanbanInj, ref(false))

provide(MetaInj, meta)

const {
  commentsDrawer,
  changedColumns,
  state: rowState,
  isNew,
  loadRow,
  saveRowAndStay,
  syncLTARRefs,
  save,
} = useProvideExpandedFormStore(meta, row)

const duplicatingRowInProgress = ref(false)

if (props.loadRow) {
  await loadRow()
}

if (props.rowId) {
  try {
    await loadRow(props.rowId)
  } catch (e: any) {
    if (e.response?.status === 404) {
      // todo: i18n
      message.error('Record not found')
      router.replace({ query: {} })
    } else throw e
  }
}

useProvideSmartsheetStore(ref({}) as Ref<ViewType>, meta)

provide(IsFormInj, ref(true))

watch(
  state,
  () => {
    if (state.value) {
      rowState.value = state.value
    } else {
      rowState.value = {}
    }
  },
  { immediate: true },
)

const isExpanded = useVModel(props, 'modelValue', emits, {
  defaultValue: false,
})

const onClose = () => {
  if (row.value?.rowMeta?.new) emits('cancel')
  isExpanded.value = false
}

const onDuplicateRow = () => {
  duplicatingRowInProgress.value = true
  const newRow = Object.assign(
    {},
    {
      row: row.value.row,
      oldRow: {},
      rowMeta: { new: true },
    },
  )
  setTimeout(async () => {
    row.value = newRow
    duplicatingRowInProgress.value = false
    message.success(t('msg.success.rowDuplicatedWithoutSavedYet'))
  }, 500)
}

const onNext = async () => {
  await save()
  emits('next')
}

const reloadParentRowHook = inject(ReloadRowDataHookInj, createEventHook())

// override reload trigger and use it to reload grid and the form itself
const reloadHook = createEventHook()

reloadHook.on(() => {
  reloadParentRowHook?.trigger(false)
  if (isNew.value) return
  loadRow()
})
provide(ReloadRowDataHookInj, reloadHook)

if (isKanban.value) {
  // adding column titles to changedColumns if they are preset
  for (const [k, v] of Object.entries(row.value.row)) {
    if (v) {
      changedColumns.value.add(k)
    }
  }
}

const cellWrapperEl = ref<HTMLElement>()

onMounted(() => {
  setTimeout(() => (cellWrapperEl.value?.querySelector('input,select,textarea') as HTMLInputElement)?.focus())
})

const addNewRow = () => {
  setTimeout(async () => {
    row.value = {
      row: {},
      oldRow: {},
      rowMeta: { new: true },
    }
    rowState.value = {}
    key.value++
    isExpanded.value = true
  }, 500)
}

// attach keyboard listeners to switch between rows
// using alt + left/right arrow keys
useActiveKeyupListener(
  isExpanded,
  async (e: KeyboardEvent) => {
    if (!e.altKey) return
    if (e.key === 'ArrowLeft') {
      e.stopPropagation()
      emits('prev')
    } else if (e.key === 'ArrowRight') {
      e.stopPropagation()
      emits('next')
    }
    // on alt + s save record
    else if (e.code === 'KeyS') {
      // remove focus from the active input if any
      document.activeElement?.blur()

      e.stopPropagation()

      if (isNew.value) {
        const data = await save(rowState.value)
        await syncLTARRefs(data)
        reloadHook?.trigger(null)
      } else {
        await save()
        reloadHook?.trigger(null)
      }
      if (!saveRowAndStay.value) {
        onClose()
      }
      // on alt + n create new record
    } else if (e.code === 'KeyN') {
      // remove focus from the active input if any to avoid unwanted input
      ;(document.activeElement as HTMLInputElement)?.blur?.()

      if (changedColumns.value.size > 0) {
        await Modal.confirm({
          title: 'Do you want to save the changes?',
          okText: 'Save',
          cancelText: 'Discard',
          onOk: async () => {
            await save()
            reloadHook?.trigger(null)
            addNewRow()
          },
          onCancel: () => {
            addNewRow()
          },
        })
      } else if (isNew.value) {
        await Modal.confirm({
          title: 'Do you want to save the record?',
          okText: 'Save',
          cancelText: 'Discard',
          onOk: async () => {
            const data = await save(rowState.value)
            await syncLTARRefs(data)
            reloadHook?.trigger(null)
            addNewRow()
          },
          onCancel: () => {
            addNewRow()
          },
        })
      } else {
        addNewRow()
      }
    }
  },
  { immediate: true },
)
</script>

<script lang="ts">
export default {
  name: 'ExpandedForm',
}
</script>

<template>
  <a-drawer
    v-model:visible="isExpanded"
    :footer="null"
    :width="commentsDrawer ? 'min(90vw,900px)' : 'min(90vw,700px)'"
    :body-style="{ 'padding': 0, 'display': 'flex', 'flex-direction': 'column' }"
    :closable="false"
    class="nc-drawer-expanded-form"
    :class="{ active: isExpanded }"
  >
    <SmartsheetExpandedFormHeader :view="props.view" @cancel="onClose" @duplicate-row="onDuplicateRow" />

    <div :key="key" class="!bg-gray-100 rounded flex-1">
      <div class="flex h-full nc-form-wrapper items-stretch min-h-[max(70vh,100%)]">
        <div class="flex-1 overflow-auto scrollbar-thin-dull nc-form-fields-container relative">
          <template v-if="props.showNextPrevIcons">
            <a-tooltip v-if="!props.firstRow" placement="bottom">
              <template #title>
                {{ $t('labels.prevRow') }}

                <GeneralShortcutLabel class="justify-center" :keys="['Alt', '←']" />
              </template>
              <MdiChevronLeft class="cursor-pointer nc-prev-arrow" @click="$emit('prev')" />
            </a-tooltip>

            <a-tooltip v-if="!props.lastRow" placement="bottom">
              <template #title>
                {{ $t('labels.nextRow') }}
                <GeneralShortcutLabel class="justify-center" :keys="['Alt', '→']" />
              </template>
              <MdiChevronRight class="cursor-pointer nc-next-arrow" @click="onNext" />
            </a-tooltip>
          </template>
          <div class="w-[500px] mx-auto">
            <div v-if="duplicatingRowInProgress" class="flex items-center justify-center h-[100px]">
              <a-spin size="large" />
            </div>
            <div
              v-for="(col, i) of fields"
              v-else
              v-show="!isVirtualCol(col) || !isNew || col.uidt === UITypes.LinkToAnotherRecord"
              :key="col.title"
              class="mt-2 py-2"
              :class="`nc-expand-col-${col.title}`"
              :data-testid="`nc-expand-col-${col.title}`"
            >
              <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" />

              <LazySmartsheetHeaderCell v-else :column="col" />

              <div
                :ref="i ? null : (el) => (cellWrapperEl = el)"
                class="!bg-white rounded px-1 min-h-[35px] flex items-center mt-2 relative"
              >
                <LazySmartsheetVirtualCell v-if="isVirtualCol(col)" v-model="row.row[col.title]" :row="row" :column="col" />

                <LazySmartsheetCell
                  v-else
                  v-model="row.row[col.title]"
                  :column="col"
                  :edit-enabled="true"
                  :active="true"
                  @update:model-value="changedColumns.add(col.title)"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-if="!isNew" class="nc-comments-drawer min-w-0 min-h-full max-h-full" :class="{ active: commentsDrawer }">
          <div class="h-full">
            <LazySmartsheetExpandedFormComments v-if="commentsDrawer" />
          </div>
        </div>
      </div>
    </div>
  </a-drawer>
</template>

<style scoped lang="scss">
:deep(input, select, textarea) {
  @apply !bg-white;
}

:deep(.ant-modal-body) {
  @apply !bg-gray-100;
}

.nc-comments-drawer {
  @apply w-0 transition-width ease-in-out duration-200;
  overflow: hidden;

  &.active {
    @apply w-[250px] border-left-1;
  }
}

.nc-form-wrapper {
  max-height: max(calc(100vh - 65px), 600px);
  height: max-content !important;
}

.nc-prev-arrow,
.nc-next-arrow {
  @apply absolute opacity-70 rounded-full transition-transform transition-background transition-opacity transform bg-white hover:(bg-gray-200) active:(scale-125 opacity-100) text-xl;
}

.nc-prev-arrow {
  @apply left-4 top-4;
}

.nc-next-arrow {
  @apply right-4 top-4;
}
</style>
