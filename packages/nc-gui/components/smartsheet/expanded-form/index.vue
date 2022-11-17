<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'
import { UITypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import type { Ref } from 'vue'
import {
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
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'cancel'])

const row = ref(props.row)

const state = toRef(props, 'state')

const meta = toRef(props, 'meta')

const router = useRouter()

const fields = computedInject(FieldsInj, (_fields) => {
  if (props.useMetaFields) {
    return (meta.value.columns ?? []).filter((col) => !isSystemColumn(col))
  }
  return _fields?.value ?? []
})

const isKanban = inject(IsKanbanInj, ref(false))

provide(MetaInj, meta)

const { commentsDrawer, changedColumns, state: rowState, isNew, loadRow } = useProvideExpandedFormStore(meta, row)

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
    width="min(90vw,1000px)"
    :body-style="{ 'padding': 0, 'display': 'flex', 'flex-direction': 'column' }"
    :closable="false"
    class="nc-drawer-expanded-form"
    :class="{ active: isExpanded }"
  >
    <SmartsheetExpandedFormHeader :view="props.view" @cancel="onClose" />

    <div class="!bg-gray-100 rounded flex-1">
      <div class="flex h-full nc-form-wrapper items-stretch min-h-[max(70vh,100%)]">
        <div class="flex-1 overflow-auto scrollbar-thin-dull nc-form-fields-container">
          <div class="w-[500px] mx-auto">
            <div
              v-for="col of fields"
              v-show="!isVirtualCol(col) || !isNew || col.uidt === UITypes.LinkToAnotherRecord"
              :key="col.title"
              class="mt-2 py-2"
              :class="`nc-expand-col-${col.title}`"
              :data-testid="`nc-expand-col-${col.title}`"
            >
              <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" />

              <LazySmartsheetHeaderCell v-else :column="col" />

              <div class="!bg-white rounded px-1 min-h-[35px] flex items-center mt-2">
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
</style>
