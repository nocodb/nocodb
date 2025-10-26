<script lang="ts" setup>
import type { ClientType, RowColoringInfoFilter, RowColoringInfoFilterRow } from 'nocodb-sdk'
import { useDebounceFn } from '@vueuse/core'
import Draggable from 'vuedraggable'
import { clearRowColouringCache } from '../../../../../components/smartsheet/grid/canvas/utils/canvas'

interface Props {
  modelValue?: RowColoringInfoFilter
  columns: ColumnTypeForFilter[]
  filterPerViewLimit: number
  disabled?: boolean
  isLockedView?: boolean
  dbClientType?: ClientType
  isLoadingFilter?: boolean
  handler: {
    conditionAdd: () => void
    conditionUpdate: (params: { index: number; color: string; is_set_as_background: boolean; nc_order?: number }) => void
    conditionDelete: (index: number) => void
    allConditionDeleted: () => void
    filters: {
      addFilter: (index: number, event: FilterGroupChangeEvent) => Promise<void>
      addFilterGroup: (index: number, event: FilterGroupChangeEvent) => Promise<void>
      deleteFilter: (index: number, event: FilterGroupChangeEvent) => Promise<void>
      rowChange: (index: number, event: FilterRowChangeEvent) => Promise<void>
    }
  }
}

interface Emits {
  (event: 'change', model: FilterGroupChangeEvent): void
  (event: 'removeAll', model: RowColoringInfoFilter): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'modelValue', emits)

const { isUIAllowed } = useRoles()

const hasPermission = computed(() => isUIAllowed('rowColourUpdate'))

const readOnlyFilter = computed(() => props.isLockedView || props.disabled)

const wrapperDomRef = ref<HTMLElement>()

const filtersCount = computed(() => {
  const execContext = { count: 0 }
  for (const rowColor of vModel.value?.conditions) {
    for (const condition of rowColor.conditions) {
      if (!condition.is_group) {
        execContext.count++
      }
    }
  }
  return execContext.count
})

const scrollToBottom = () => {
  const wrapperDomRefEl = wrapperDomRef.value?.$el as HTMLDivElement

  wrapperDomRefEl?.scrollTo({
    top: wrapperDomRefEl?.scrollHeight,
    behavior: 'smooth',
  })
}

const addColor = () => {
  props.handler.conditionAdd()
  nextTick(() => {
    scrollToBottom()
  })
}

const removeColor = (index: number) => {
  if (vModel.value!.conditions.length === 1) {
    props.handler.allConditionDeleted()
  } else {
    props.handler.conditionDelete(index)
  }
  clearRowColouringCache()
}

const updateColorPendingPayload = ref({})
const debouncedUpdateColor = useDebounceFn(() => props.handler.conditionUpdate(updateColorPendingPayload.value), 200)
const updateColor = (index: number, field: string, value: string) => {
  if (field === 'color') {
    updateColorPendingPayload.value = {
      index,
      ...vModel.value!.conditions[index],
      [field]: value,
    } as any
    debouncedUpdateColor()
  } else {
    props.handler.conditionUpdate({
      index,
      ...vModel.value!.conditions[index],
      [field]: value,
    } as any)
  }
  clearRowColouringCache()
}

function onMoveCallback(event: any) {
  // disable nested drag drop for now
  if (event.from !== event.to) {
    return false
  }
}

const onMove = async (event: { moved: { newIndex: number; oldIndex: number; element: RowColoringInfoFilterRow } }) => {
  if (!hasPermission.value) return

  /**
   * If event has moved property that means reorder is on same level
   */
  if (event.moved) {
    const {
      moved: { newIndex = 0, oldIndex = 0, element },
    } = event

    const colorConditions = vModel.value?.conditions || []

    if (!element || (!element.id && !element.tmp_id) || colorConditions.length === 1) return

    let nextOrder: number

    // set new order value based on the new order of the items
    if (colorConditions.length - 1 === newIndex) {
      // If moving to the end, set nextOrder greater than the maximum order in the list
      nextOrder = Math.max(...colorConditions.map((item) => item?.nc_order ?? 0)) + 1
    } else if (newIndex === 0) {
      // If moving to the beginning, set nextOrder smaller than the minimum order in the list
      nextOrder = Math.min(...colorConditions.map((item) => item?.nc_order ?? 0)) / 2
    } else {
      nextOrder =
        (parseFloat(String(colorConditions[newIndex - 1]?.nc_order ?? 0)) +
          parseFloat(String(colorConditions[newIndex + 1]?.nc_order ?? 0))) /
        2
    }

    const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

    element.nc_order = _nextOrder

    const elementIndex =
      colorConditions.findIndex((item) => item?.id === element?.id) ||
      colorConditions.findIndex((item) => item?.tmp_id === element?.tmp_id)

    await props.handler.conditionUpdate({
      index: elementIndex,
      ...element,
      nc_order: _nextOrder,
    })
  }
}
</script>

<template>
  <div class="min-w-[640px] w-auto inline-block h-auto rounded-2xl bg-nc-bg-default p-4">
    <div class="flex flex-col gap-3">
      <Draggable
        ref="wrapperDomRef"
        v-bind="getDraggableAutoScrollOptions({ scrollSensitivity: 100 })"
        :list="vModel?.conditions || []"
        :disabled="!hasPermission"
        group="nc-row-color-filter-groups"
        ghost-class="bg-nc-bg-gray-extralight"
        draggable=".nc-row-color-filter-group"
        handle=".nc-row-color-filter-group-drag-handler"
        class="border-1 border-nc-border-gray-medium rounded-lg bg-nc-bg-gray-extralight max-h-[60vh] nc-scrollbar-thin"
        :move="onMoveCallback"
        @change="onMove($event)"
      >
        <template #item="{ element: rowColorConfig, index: i }">
          <div
            :key="i"
            class="nc-row-color-filter-group px-2 border-b-1 border-nc-border-gray-medium last-of-type:border-b-0 bg-nc-gray-100"
          >
            <!-- index here is 0, since we evaluate the logic op individually per color -->
            <SmartsheetToolbarFilterGroup
              v-model="rowColorConfig.nestedConditions"
              :index="0"
              :nested-level="0"
              :columns="columns"
              :disabled="disabled || isLockedView"
              :is-locked-view="false"
              :is-logical-op-change-allowed="false"
              :web-hook="false"
              :link="false"
              :is-form="true"
              :is-public="false"
              :is-full-width="true"
              :filter-per-view-limit="filterPerViewLimit"
              :disable-add-new-filter="false"
              action-btn-type="text"
              :filters-count="filtersCount"
              :db-client-type="dbClientType"
              :handler="{
                addFilter: ($event) => handler.filters.addFilter(i, $event),
                addFilterGroup: ($event) => handler.filters.addFilterGroup(i, $event),
                deleteFilter: ($event) => handler.filters.deleteFilter(i, $event),
                rowChange: ($event) => handler.filters.rowChange(i, $event),
              }"
              :query-filter="false"
              is-colour-filter
              :read-only="isLockedView || disabled"
              :is-loading-filter="isLoadingFilter"
            >
              <template #root-header>
                <div class="flex justify-between w-full pb-2">
                  <div class="flex-grow">
                    <template v-if="!readOnlyFilter">
                      <GeneralAdvanceColorPickerDropdown v-model="rowColorConfig.color" @change="updateColor(i, 'color', $event)">
                        <NcButton
                          type="text"
                          size="small"
                          :style="{
                            'background-color': rowColorConfig.color,
                          }"
                        >
                          <span
                            :style="{
                              color: getOppositeColorOfBackground(rowColorConfig.color),
                            }"
                          >
                            <component :is="iconMap.chevronDown" />
                          </span>
                        </NcButton>
                      </GeneralAdvanceColorPickerDropdown>
                    </template>
                    <template v-else>
                      <NcButton
                        type="text"
                        size="small"
                        :style="{
                          'background-color': rowColorConfig.color,
                        }"
                        :disabled="true"
                      >
                      </NcButton>
                    </template>
                  </div>
                  <div class="flex items-center justify-end">
                    <NcButton
                      v-if="!disabled"
                      type="text"
                      size="small"
                      class="nc-filter-item-remove-btn cursor-pointer"
                      :disabled="readOnlyFilter"
                      @click="removeColor(i)"
                    >
                      <component :is="iconMap.deleteListItem" />
                    </NcButton>
                    <NcButton
                      v-if="!disabled && hasPermission"
                      type="text"
                      size="small"
                      class="nc-filter-item-reorder-btn nc-row-color-filter-group-drag-handler self-center"
                      :shadow="false"
                      :disabled="(vModel?.conditions || []).length === 1"
                    >
                      <GeneralIcon icon="drag" class="flex-none h-4 w-4" />
                    </NcButton>
                  </div>
                </div>
              </template>

              <template #root-add-filter-row>
                <div class="flex-grow flex justify-end items-center">
                  <div class="flex items-center cursor-pointer select-none text-nc-content-gray">
                    <NcSwitch
                      v-model:checked="rowColorConfig.is_set_as_background"
                      placement="right"
                      @change="updateColor(i, 'is_set_as_background', $event)"
                    >
                      {{ $t('labels.backgroundColour') }}
                    </NcSwitch>
                  </div>
                </div>
              </template>
            </SmartsheetToolbarFilterGroup>
          </div>
        </template>
      </Draggable>

      <div v-if="hasPermission">
        <NcButton
          v-e="['c:row-color:add']"
          type="text"
          size="small"
          :class="{
            '!text-nc-content-brand': !readOnlyFilter,
          }"
          :disabled="readOnlyFilter"
          @click="addColor"
        >
          <template #icon>
            <component :is="iconMap.plus" />
          </template>
          {{ $t('labels.addColour') }}
        </NcButton>
      </div>
    </div>
  </div>
</template>
