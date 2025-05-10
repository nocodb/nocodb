<script lang="ts" setup>
import type { ClientType, RowColoringInfoFilter } from 'nocodb-sdk'
import { useDebounceFn } from '@vueuse/core'

interface Props {
  modelValue?: RowColoringInfoFilter
  columns: ColumnTypeForFilter[]
  filterPerViewLimit: number
  disabled?: boolean
  isLockedView?: boolean
  dbClientType?: ClientType
  handler: {
    conditionAdd: () => void
    conditionUpdate: (params: { index: number; color: string; is_set_as_background: boolean }) => void
    conditionDelete: (index: number) => void
    allConditionDeleted: () => void
    filterAdd: () => void
    filterUpdate: () => void
    filterDelete: () => void
  }
}

interface Emits {
  (event: 'change', model: FilterGroupChangeEvent): void
  (event: 'removeAll', model: RowColoringInfoFilter): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'modelValue', emits)

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

const addColor = () => {
  props.handler.conditionAdd()
}

const removeColor = (index: number) => {
  if (vModel.value!.conditions.length === 1) {
    props.handler.allConditionDeleted()
  } else {
    props.handler.conditionDelete(index)
  }
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
}
</script>

<template>
  <div class="min-w-[640px] w-auto inline-block h-auto rounded-2xl bg-white p-4">
    <div class="flex flex-col gap-3">
      <template v-for="(rowColorConfig, i) in vModel?.conditions" :key="i">
        <div>
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
            :query-filter="false"
          >
            <template #root-header>
              <div class="flex justify-between w-full pb-2">
                <div class="flex-grow">
                  <template v-if="!disabled && !isLockedView">
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
                        'background-color': getLighterTint(rowColorConfig.color, { saturationMod: 15 }),
                      }"
                      :disabled="true"
                    >
                    </NcButton>
                  </template>
                </div>
                <div class="justify-end">
                  <NcButton
                    v-if="!disabled"
                    type="text"
                    size="small"
                    class="nc-filter-item-remove-btn cursor-pointer"
                    :disabled="isLockedView"
                    @click="removeColor(i)"
                  >
                    <component :is="iconMap.deleteListItem" />
                  </NcButton>
                </div>
              </div>
            </template>

            <template #root-add-filter-row>
              <div class="flex-grow flex justify-end items-center">
                <NcSwitch
                  v-model:checked="rowColorConfig.is_set_as_background"
                  @change="updateColor(i, 'is_set_as_background', $event)"
                >
                  Background color
                </NcSwitch>
              </div>
            </template>
          </SmartsheetToolbarFilterGroup>
        </div>
      </template>
      <div>
        <NcButton type="text" size="small" class="hover:!text-brand-500 hover:!bg-transparent" @click="addColor">
          <template #icon>
            <component :is="iconMap.plus" />
          </template>
          Add Color
        </NcButton>
      </div>
    </div>
  </div>
</template>
