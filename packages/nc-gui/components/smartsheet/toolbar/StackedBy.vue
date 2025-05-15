<script setup lang="ts">
import type { ColumnType, KanbanType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'

provide(IsKanbanInj, ref(true))

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const IsPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const { fields, loadViewColumns, metaColumnById } = useViewColumnsOrThrow(activeView, meta)

const { kanbanMetaData, loadKanbanMeta, loadKanbanData, updateKanbanMeta, groupingField } = useKanbanViewStoreOrThrow()

const { addUndo, defineViewScope } = useUndoRedo()

const open = ref(false)

useMenuCloseOnEsc(open)

watch(
  () => activeView.value?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && meta.value) {
      await loadViewColumns()
    }
  },
  { immediate: true },
)

const updateGroupingField = async (v: string) => {
  await updateKanbanMeta({
    fk_grp_col_id: v,
  })
  await loadKanbanMeta()
  await loadKanbanData()
  ;(activeView.value?.view as KanbanType).fk_grp_col_id = v
}

const groupingFieldColumnId = computed({
  get: () => kanbanMetaData.value.fk_grp_col_id,
  set: async (val) => {
    if (val) {
      addUndo({
        undo: {
          fn: await updateGroupingField,
          args: [kanbanMetaData.value.fk_grp_col_id],
        },
        redo: {
          fn: await updateGroupingField,
          args: [val],
        },
        scope: defineViewScope({ view: activeView.value }),
      })

      await updateGroupingField(val)
    }
  },
})

const updateHideEmptyStack = async (v: boolean) => {
  const payload = {
    ...parseProp(kanbanMetaData.value?.meta),
    hide_empty_stack: v,
  }
  await updateKanbanMeta({
    meta: payload,
  })
  await loadKanbanMeta()
  ;(activeView.value?.view as KanbanType).meta = payload
}

const isLoading = ref<'hideEmptyStack' | null>(null)

const hideEmptyStack = computed({
  get: () => {
    return parseProp(kanbanMetaData.value?.meta).hide_empty_stack || false
  },
  set: async (val: boolean) => {
    isLoading.value = 'hideEmptyStack'

    addUndo({
      undo: {
        fn: updateHideEmptyStack,
        args: [hideEmptyStack.value],
      },
      redo: {
        fn: updateHideEmptyStack,
        args: [val],
      },
      scope: defineViewScope({ view: activeView.value }),
    })

    await updateHideEmptyStack(val)

    isLoading.value = null
  },
})

const singleSelectFieldOptions = computed<SelectProps['options']>(() => {
  return fields.value
    ?.filter((el) => el.fk_column_id && metaColumnById.value[el.fk_column_id].uidt === UITypes.SingleSelect)
    .map((field) => {
      return {
        value: field.fk_column_id,
        label: field.title,
      }
    })
})

const handleChange = () => {
  open.value = false
}

const getIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: c,
  })
</script>

<template>
  <NcDropdown
    v-if="!IsPublic"
    v-model:visible="open"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-kanban-stacked-by-menu overflow-hidden"
    class="!xs:hidden"
  >
    <NcTooltip :disabled="!isToolbarIconMode" class="nc-kanban-btn">
      <template #title>
        {{ $t('activity.kanban.stackedBy') }}
      </template>

      <NcButton
        v-e="['c:kanban:change-grouping-field']"
        class="nc-kanban-stacked-by-menu-btn nc-toolbar-btn !border-0 !h-7 group"
        size="small"
        type="secondary"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-2">
          <GeneralIcon icon="settings" class="h-4 w-4" />
          <div v-if="!isToolbarIconMode" class="flex items-center gap-0.5">
            <span class="text-capitalize !text-[13px] font-medium flex items-center gap-1">
              {{ $t('activity.kanban.stackedBy') }}
            </span>
            <div
              class="flex items-center rounded-md transition-colors duration-0.3s bg-gray-100 px-1 min-h-5 max-w-[108px]"
              :class="{
                'group-hover:bg-gray-200': !isLocked,
              }"
            >
              <span class="!text-[13px] font-medium truncate !leading-5">{{ groupingField }}</span>
            </div>
          </div>
        </div>
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <div v-if="open" class="p-4 w-90 bg-white nc-table-toolbar-menu rounded-lg flex flex-col gap-5" @click.stop>
        <div class="flex flex-col gap-2">
          <div>
            {{ $t('general.groupingField') }}
          </div>
          <div class="nc-fields-list">
            <div class="grouping-field">
              <a-select
                v-model:value="groupingFieldColumnId"
                class="nc-select-shadow w-full nc-kanban-grouping-field-select !rounded-lg"
                dropdown-class-name="!rounded-lg"
                placeholder="Select a Grouping Field"
                :disabled="isLocked"
                @change="handleChange"
                @click.stop
              >
                <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-gray-700" /></template>
                <a-select-option v-for="option of singleSelectFieldOptions" :key="option.value" :value="option.value">
                  <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                    <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                      <component
                        :is="getIcon(metaColumnById[option.value])"
                        v-if="option.value"
                        class="!w-3.5 !h-3.5 !text-current opacity-80 !ml-0"
                      />

                      <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                        <template #title>
                          {{ option.label }}
                        </template>
                        <template #default>{{ option.label }}</template>
                      </NcTooltip>
                    </div>
                    <GeneralIcon
                      v-if="groupingFieldColumnId === option.value"
                      id="nc-selected-item-icon"
                      icon="check"
                      class="flex-none text-primary w-4 h-4"
                    />
                  </div> </a-select-option
              ></a-select>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <NcSwitch
            v-model:checked="hideEmptyStack"
            size="small"
            class="nc-switch"
            :loading="isLoading === 'hideEmptyStack'"
            :disabled="isLocked"
          >
            <div class="text-sm text-gray-800">
              {{ $t('general.hide') }}
              {{ $t('general.empty').toLowerCase() }}
              {{ $t('general.stack').toLowerCase() }}
            </div>
          </NcSwitch>
        </div>
        <GeneralLockedViewFooter v-if="isLocked" class="-mb-4 -mx-4" @on-open="open = false" />
      </div>
    </template>
  </NcDropdown>
</template>
